"""Uebungen bauen (Daten) und auswerten. Die Auswertung ist Backend-Logik, nie LLM."""
from __future__ import annotations

import hashlib
import random
import re
import unicodedata
from typing import Any

SCHEMA_VERSION = "1.0.0"


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def normalize(s: str, *, accents: bool = False) -> str:
    s = s.casefold().strip()
    s = re.sub(r"[¿?¡!.,;:\"“”„'’]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s if accents else _strip_accents(s)


def seeded_rng(*parts: object) -> random.Random:
    h = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()
    return random.Random(int(h[:16], 16))


def base_exercise(ex_id: str, ex_type: str, language: str, item_id: str, skill: str, level: str, decidable: bool, say: str, pack_status: str) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION, "id": ex_id, "type": ex_type, "language": language, "item_id": item_id,
        "skill": skill, "level": level, "decidable": decidable,
        "prompt": {"say": say, "translation": None, "audio_url": None, "hint": None},
        "content": {}, "source": "curriculum", "pack_status": pack_status,
    }


def public_view(ex: dict[str, Any]) -> dict[str, Any]:
    """Entfernt die erwartete Antwort vor der Auslieferung."""
    out = {k: v for k, v in ex.items() if k != "expected_answer"}
    return out


def evaluate(ex_type: str, expected: Any, given: Any) -> bool:
    if ex_type == "flashcard":
        return str(given).lower() in {"good", "easy", "hard"}
    if ex_type in ("speak_repeat", "roleplay"):
        # Nicht entscheidbar: `correct` steuert nur Feedback/FSRS, nie Herzen.
        if isinstance(expected, str) and isinstance(given, str):
            e, g = normalize(expected).split(), normalize(given).split()
            if not e:
                return True
            hit = sum(1 for w in e if w in g)
            return hit / len(e) >= 0.7
        return True
    if ex_type == "word_order":
        exp = expected if isinstance(expected, list) else str(expected).split()
        giv = given if isinstance(given, list) else str(given).split()
        return [normalize(x) for x in exp] == [normalize(x) for x in giv]
    if ex_type == "matching":
        exp = {normalize(p.split("|")[0]): normalize(p.split("|")[1]) for p in expected}
        try:
            giv = {normalize(p.split("|")[0]): normalize(p.split("|")[1]) for p in given}
        except IndexError:
            return False
        return exp == giv
    return normalize(str(expected)) == normalize(str(given))
