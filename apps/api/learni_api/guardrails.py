"""Guardrails: Eingabe-Hygiene, Injection-Erkennung, Moderation, Topic-Guard, Ausgabe-Validierung."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import jsonschema

SCHEMA_PATH = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "schemas" / "llm_turn.schema.json"
_SCHEMA: dict[str, Any] | None = None

INJECTION_PATTERNS = [
    r"ignor(e|a|ez|iere)\b.{0,30}\b(previous|prior|above|all|vorherigen?|alle[nr]?|anteriores|précédentes?)\b",
    r"(system|developer|entwickler)[- ]?(prompt|message|nachricht|anweisung)",
    r"\b(reveal|show|print|leak|verrate|zeige|gib)\b.{0,40}\b(prompt|instructions?|anweisungen|api[- ]?key|schl(ü|ue)ssel|secret|passwort|password)\b",
    r"you are now\b|du bist jetzt\b|ab sofort bist du\b|tu es maintenant\b|ahora eres\b",
    r"\b(jailbreak|DAN mode|developer mode|god mode)\b",
    r"</?(system|assistant|user_utterance)>",
    r"\bact as\b.{0,30}\b(admin|root|developer|system)\b",
]
MODERATION_PATTERNS = {
    "self_harm": r"\b(kill myself|suicide|selbstmord|mich umbringen|me quiero morir|me tuer)\b",
    "violence": r"\b(how to (make|build) a (bomb|weapon)|bombe bauen|waffe bauen)\b",
    "sexual_minors": r"\b(child porn|kinderporno)\b",
}
OFF_TOPIC_PATTERNS = [
    r"\b(bitcoin|aktien|stock tips|investier|wahl(en|ergebnis)|election|politik|politics)\b",
    r"\b(schreib(e)? (mir )?(einen )?(code|programm|hausaufgabe)|write (me )?(code|a program|my homework))\b",
    r"\b(diagnose|dosierung|medikament|prescription)\b",
]
SECRET_LIKE = re.compile(r"(sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|gsk_[A-Za-z0-9]{16,})")
LEAK_MARKERS = ("# Unverrückbare Regeln", "<user_utterance>", "SUPABASE_", "SERVICE_ROLE")
FUNCTION_WORDS = {"a", "el", "la", "los", "las", "un", "una", "y", "de", "en", "es", "que", "por", "para", "the", "and", "is"}


class GuardrailError(Exception):
    def __init__(self, code: str, detail: str = ""):
        super().__init__(f"{code}: {detail}")
        self.code = code


def sanitize_user_text(text: str, max_chars: int = 500) -> str:
    text = "".join(c for c in text if c == "\n" or c.isprintable())
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_chars]


def wrap_user_text(text: str) -> str:
    """Nutzertext ist Daten: Tags entschaerfen, dann klar abgrenzen."""
    safe = re.sub(r"</?\s*user_utterance\s*>", "", text, flags=re.I)
    return f"<user_utterance>{safe}</user_utterance>"


def detect_injection(text: str) -> bool:
    return any(re.search(p, text, flags=re.I) for p in INJECTION_PATTERNS)


def moderate(text: str) -> str | None:
    for cat, pat in MODERATION_PATTERNS.items():
        if re.search(pat, text, flags=re.I):
            return cat
    return None


def off_topic(text: str) -> bool:
    return any(re.search(p, text, flags=re.I) for p in OFF_TOPIC_PATTERNS)


def cap_tokens(text: str, max_tokens: int) -> str:
    """Grobe Obergrenze (~4 Zeichen je Token)."""
    return text[: max_tokens * 4]


def _schema() -> dict[str, Any]:
    global _SCHEMA
    if _SCHEMA is None:
        _SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    return _SCHEMA


def validate_llm_turn(raw: str) -> dict[str, Any]:
    """Parst und validiert die LLM-Ausgabe. Alles ausser reinem Schema-JSON wird verworfen."""
    s = raw.strip()
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", s)
    try:
        data = json.loads(s)
    except json.JSONDecodeError as e:
        raise GuardrailError("invalid_json", str(e)) from e
    try:
        jsonschema.validate(data, _schema())
    except jsonschema.ValidationError as e:
        raise GuardrailError("schema_violation", e.message) from e
    blob = json.dumps(data, ensure_ascii=False)
    if SECRET_LIKE.search(blob) or any(m in blob for m in LEAK_MARKERS):
        raise GuardrailError("leak", "output looks like it contains internal data")
    return data


def unknown_word_ratio(text: str, whitelist: set[str]) -> tuple[float, list[str]]:
    words = [w.lower().strip("¿?¡!.,;:\"'") for w in text.split()]
    words = [w for w in words if w and w not in FUNCTION_WORDS]
    if not words:
        return 0.0, []
    unknown = [w for w in words if w not in whitelist]
    return len(unknown) / len(words), unknown


def check_vocab(text: str, whitelist: set[str], level: str, max_ratio: dict[str, float] | None = None) -> list[str]:
    """Gibt unbekannte Woerter zurueck, wenn die Quote das Level-Limit ueberschreitet (leer = ok)."""
    limits = max_ratio or {"A1": 0.34, "A2": 0.5, "B1": 0.75, "B2": 1.0}
    ratio, unknown = unknown_word_ratio(text, whitelist)
    return unknown if ratio > limits[level] else []
