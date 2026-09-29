"""Viseme-IDs 0..21 (Azure-kompatibles Schema) und Text->Viseme-Heuristik fuer Mock/TTS ohne Viseme-Events.

0 Stille | 1 ae/schwa/ʌ | 2 ɑ | 3 ɔ | 4 ɛ/ʊ | 5 ɝ | 6 j/i/ɪ | 7 w/u | 8 o | 9 aʊ | 10 ɔɪ | 11 aɪ
12 h | 13 ɹ | 14 l | 15 s/z | 16 ʃ/tʃ/dʒ/ʒ | 17 ð | 18 f/v | 19 d/t/n/θ | 20 k/g/ŋ | 21 p/b/m
"""
from __future__ import annotations

import unicodedata

LETTER_TO_VISEME = {
    "a": 2, "e": 4, "i": 6, "o": 8, "u": 7, "y": 6,
    "h": 12, "r": 13, "l": 14, "s": 15, "z": 15, "c": 20, "k": 20, "g": 20, "q": 20, "x": 20,
    "f": 18, "v": 18, "w": 7, "d": 19, "t": 19, "n": 19, "j": 16, "p": 21, "b": 21, "m": 21,
}
MIN_VISEME, MAX_VISEME = 0, 21


def _base(ch: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", ch.lower()) if unicodedata.category(c) != "Mn")


def text_to_visemes(text: str, duration_ms: int) -> list[dict[str, int]]:
    """Gleichmaessig verteilte Viseme-Events. Endet immer mit Stille (0)."""
    chars = [c for c in text if c.isalpha() or c.isspace()]
    if not chars or duration_ms <= 0:
        return [{"t_ms": 0, "viseme": 0}]
    step = duration_ms / len(chars)
    out: list[dict[str, int]] = []
    for i, ch in enumerate(chars):
        v = 0 if ch.isspace() else LETTER_TO_VISEME.get(_base(ch), 1)
        if out and out[-1]["viseme"] == v:
            continue
        out.append({"t_ms": int(i * step), "viseme": v})
    out.append({"t_ms": duration_ms, "viseme": 0})
    return out


def clamp(v: int) -> int:
    return max(MIN_VISEME, min(MAX_VISEME, int(v)))
