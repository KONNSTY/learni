"""Content-Packs laden. Status-Gate: nur `reviewed` und `published` gehen an Nutzer.

`draft` ist nur im Testmodus (APP_ENV != prod) sichtbar und wird mit Beta-Label markiert.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

LEVELS = ["A1", "A2", "B1", "B2"]
SERVED_STATUSES = frozenset({"reviewed", "published"})
VALID_STATUSES = frozenset({"draft", "reviewed", "published"})


@dataclass
class Pack:
    pack_id: str
    language: str
    level: str
    topic: str
    status: str
    items: list[dict[str, Any]]
    sentences: list[dict[str, Any]] = field(default_factory=list)
    blanks: list[dict[str, Any]] = field(default_factory=list)


class ContentLibrary:
    def __init__(self, content_dir: Path, allow_draft: bool):
        self.dir = Path(content_dir)
        self.allow_draft = allow_draft
        self.languages: list[dict[str, Any]] = json.loads((self.dir / "languages.json").read_text(encoding="utf-8"))
        self._packs: list[Pack] = []
        self.reload()

    def reload(self) -> None:
        packs: list[Pack] = []
        for f in sorted((self.dir / "packs").glob("*/*.json")):
            d = json.loads(f.read_text(encoding="utf-8"))
            if d.get("status") not in VALID_STATUSES:
                raise ValueError(f"{f}: invalid status {d.get('status')!r}")
            packs.append(Pack(d["pack_id"], d["language"], d["level"], d["topic"], d["status"], d["items"], d.get("sentences", []), d.get("blanks", [])))
        self._packs = packs

    def language(self, code: str) -> dict[str, Any] | None:
        return next((lang for lang in self.languages if lang["code"] == code), None)

    def served(self, pack: Pack) -> bool:
        return pack.status in SERVED_STATUSES or (self.allow_draft and pack.status == "draft")

    def packs(self, language: str, up_to_level: str | None = None) -> list[Pack]:
        max_i = LEVELS.index(up_to_level) if up_to_level else len(LEVELS) - 1
        out = [p for p in self._packs if p.language == language and self.served(p) and LEVELS.index(p.level) <= max_i]
        return sorted(out, key=lambda p: (LEVELS.index(p.level), min((i["frequency_rank"] for i in p.items), default=0)))

    def items(self, language: str, level: str) -> list[tuple[Pack, dict[str, Any]]]:
        """Alle Items bis inkl. `level`, sortiert nach Level dann Frequenz."""
        rows = [(p, i) for p in self.packs(language, level) for i in p.items]
        return sorted(rows, key=lambda r: (LEVELS.index(r[0].level), r[1]["frequency_rank"]))

    def find_item(self, language: str, item_id: str) -> tuple[Pack, dict[str, Any]] | None:
        for p in self.packs(language):
            for i in p.items:
                if i["item_id"] == item_id:
                    return p, i
        return None

    def topics(self, language: str, level: str) -> list[str]:
        seen: list[str] = []
        for p in self.packs(language, level):
            if p.level == level and p.topic not in seen:
                seen.append(p.topic)
        return seen

    def vocabulary_whitelist(self, language: str, level: str) -> set[str]:
        words: set[str] = set()
        for _, item in self.items(language, level):
            words.update(w.lower().strip("¿?¡!.,;:") for w in item["lemma"].split())
        for p in self.packs(language, level):
            for s in p.sentences:
                words.update(w.lower().strip("¿?¡!.,;:") for w in s["text"].split())
        return words
