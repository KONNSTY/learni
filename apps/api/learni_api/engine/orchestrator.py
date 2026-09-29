"""Lern-Orchestrator: waehlt deterministisch Item, Uebungstyp und Schwierigkeit.

Der LLM hat hier keinen Einfluss. Er darf spaeter nur den Gespraechston gestalten
(Live-Modus in voice/pipeline.py), nicht die Lernsteuerung.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from ..content import ContentLibrary, Pack
from . import exercises as X
from .fsrs import Card, retrievability
from .hearts import is_decidable

SKILLS = ("listening", "speaking", "vocabulary", "grammar")


class NoContentError(Exception):
    pass


class Orchestrator:
    def __init__(self, lib: ContentLibrary):
        self.lib = lib

    # -- Auswahl -----------------------------------------------------------------
    def pick_item(self, language: str, level: str, cards: dict[str, Card], recent: list[str], now: datetime) -> tuple[Pack, dict[str, Any], Card]:
        rows = self.lib.items(language, level)
        if not rows:
            raise NoContentError(f"no served content for {language} {level}")
        by_id = {i["item_id"]: (p, i) for p, i in rows}
        card_of = lambda iid: cards.get(iid, Card())  # noqa: E731
        due = [(retrievability(card_of(iid), now), iid) for iid in by_id if not card_of(iid).is_new and card_of(iid).due and card_of(iid).due <= now]
        if due:
            due.sort()
            iid = next((i for _, i in due if i not in recent[:2]), due[0][1])
        else:
            new = [iid for iid in by_id if card_of(iid).is_new and iid not in recent[:2]]
            if new:
                iid = new[0]
            else:  # alles gelernt und nichts faellig: schwaechstes Item ueben
                iid = min(by_id, key=lambda i: (card_of(i).stability, i))
        p, item = by_id[iid]
        return p, item, card_of(iid)

    def pick_skill(self, item: dict[str, Any], skills: dict[str, float]) -> str:
        tags = [t for t in item.get("skill_tags", ["vocabulary"]) if t in SKILLS] or ["vocabulary"]
        return min(tags, key=lambda t: (skills.get(t, 0.0), SKILLS.index(t)))

    def pick_type(self, skill: str, card: Card, pack: Pack, item: dict[str, Any]) -> str:
        if card.is_new:
            return "flashcard"
        if skill == "listening":
            return "listen_pick"
        if skill == "speaking":
            return "speak_repeat"
        if skill == "grammar":
            return "fill_blank" if pack.blanks else "word_order"
        # vocabulary
        if card.stability < 5:
            return "multiple_choice"
        if any(item["lemma"].lower() in s["text"].lower() for s in pack.sentences):
            return "word_order"
        return "multiple_choice"

    # -- Bau ---------------------------------------------------------------------
    def build(self, *, user_id: str, language: str, level: str, skills: dict[str, float], cards: dict[str, Card],
              recent: list[str], now: datetime, seq: int, ui_lang: str = "de", accuracy: float = 1.0,
              decidable_allowed: bool = True) -> dict[str, Any]:
        pack, item, card = self.pick_item(language, level, cards, recent, now)
        skill = self.pick_skill(item, skills)
        ex_type = self.pick_type(skill, card, pack, item)
        if not decidable_allowed and is_decidable(ex_type):
            ex_type, skill = "speak_repeat", "speaking"  # Herzen leer: nur nicht entscheidbare Formate
        rng = X.seeded_rng(user_id, now.date().isoformat(), seq, item["item_id"])
        ex_id = "ex_" + X.seeded_rng(user_id, seq, item["item_id"], now.isoformat()).getrandbits(48).to_bytes(6, "big").hex()
        n_opts = 3 if level == "A1" else 4
        hinted = accuracy < 0.6 or card.lapses > 0
        tr = item["translations"].get(ui_lang) or item["translations"]["en"]
        ex = X.base_exercise(ex_id, ex_type, language, item["item_id"], skill, level, is_decidable(ex_type), item["lemma"], pack.status)
        ex["prompt"]["translation"] = tr
        ex["expected_answer"] = None

        pool = [i for _, i in self.lib.items(language, level) if i["item_id"] != item["item_id"]]

        def distractors(field: str) -> list[str]:
            vals = []
            for i in pool:
                v = i["translations"].get(ui_lang) or i["translations"]["en"] if field == "tr" else i["lemma"]
                if v not in vals:
                    vals.append(v)
            rng.shuffle(vals)
            return vals[: n_opts - 1]

        if ex_type == "flashcard":
            ex["content"] = {"target_text": item["lemma"]}
            ex["skill"] = "vocabulary"
        elif ex_type in ("multiple_choice", "listen_pick"):
            opts = [tr, *distractors("tr")]
            rng.shuffle(opts)
            ex["content"] = {"options": opts}
            ex["expected_answer"] = tr
            if ex_type == "multiple_choice":
                ex["prompt"]["translation"] = None  # Loesung nicht mitliefern
        elif ex_type == "speak_repeat":
            ex["content"] = {"target_text": item["lemma"]}
            ex["expected_answer"] = item["lemma"]
        elif ex_type == "fill_blank":
            blank = pack.blanks[seq % len(pack.blanks)]
            ex["item_id"] = item["item_id"]
            ex["prompt"]["say"] = blank["sentence"].replace("___", "…")
            ex["prompt"]["translation"] = blank["translations"].get(ui_lang) or blank["translations"]["en"]
            opts = list(blank["options"])
            rng.shuffle(opts)
            ex["content"] = {"sentence_with_blank": blank["sentence"], "options": opts}
            ex["expected_answer"] = blank["answer"]
        elif ex_type == "word_order":
            sent = next((s for s in pack.sentences if item["lemma"].lower() in s["text"].lower()), pack.sentences[0] if pack.sentences else None)
            if sent is None:
                return self._as_multiple_choice(ex, item, tr, distractors, rng)
            toks = list(sent["tokens"])
            rng.shuffle(toks)
            ex["prompt"]["say"] = sent["translations"].get(ui_lang) or sent["translations"]["en"]
            ex["prompt"]["translation"] = None
            ex["content"] = {"tokens": toks}
            ex["expected_answer"] = list(sent["tokens"])
        if hinted and ex_type in ("multiple_choice", "fill_blank", "listen_pick", "word_order"):
            ex["prompt"]["hint"] = f"Tipp: {item['lemma'][0]}…"
        return ex

    def _as_multiple_choice(self, ex: dict[str, Any], item: dict[str, Any], tr: str, distractors: Any, rng: Any) -> dict[str, Any]:
        ex["type"], ex["decidable"], ex["skill"] = "multiple_choice", True, "vocabulary"
        opts = [tr, *distractors("tr")]
        rng.shuffle(opts)
        ex["prompt"]["say"], ex["prompt"]["translation"] = item["lemma"], None
        ex["content"] = {"options": opts}
        ex["expected_answer"] = tr
        return ex
