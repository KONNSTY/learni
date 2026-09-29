"""Mock-Adapter: deterministisch, ohne Keys, klar als Mock markiert. Ausgaben werden nie als Lerninhalt gespeichert."""
from __future__ import annotations

import io
import json
import math
import struct
import wave

from .base import LLMResult, PronResult, STTResult, TTSResult
from .visemes import text_to_visemes

# Feste Beispieldialoge pro Sprache (Test-Tutor). Index = Anzahl bisheriger Nutzer-Turns.
MOCK_DIALOGS: dict[str, list[dict]] = {
    "es": [
        {"say": "¡Hola! ¿Cómo te llamas?", "exercise_type": "none", "expected_answer": None, "hint": "Sag: Me llamo …"},
        {"say": "Mucho gusto. ¿Qué quieres beber?", "exercise_type": "multiple_choice", "options": ["Un café", "Un coche", "Una casa"], "expected_answer": "Un café", "hint": "Denk an ein Getränk."},
        {"say": "¡Muy bien! Repite: Quiero un café.", "exercise_type": "speak_repeat", "expected_answer": "Quiero un café", "hint": None},
        {"say": "¡Excelente! Hasta luego.", "exercise_type": "none", "expected_answer": None, "hint": None},
    ],
    "en": [
        {"say": "Hello! What is your name?", "exercise_type": "none", "expected_answer": None, "hint": "Say: My name is …"},
        {"say": "Nice to meet you. What would you like to drink?", "exercise_type": "multiple_choice", "options": ["Coffee", "Car", "House"], "expected_answer": "Coffee", "hint": None},
        {"say": "Great! Repeat: I would like a coffee.", "exercise_type": "speak_repeat", "expected_answer": "I would like a coffee", "hint": None},
        {"say": "Excellent! See you later.", "exercise_type": "none", "expected_answer": None, "hint": None},
    ],
    "fr": [
        {"say": "Bonjour ! Comment tu t'appelles ?", "exercise_type": "none", "expected_answer": None, "hint": None},
        {"say": "Enchanté. Tu veux boire quoi ?", "exercise_type": "multiple_choice", "options": ["Un café", "Une voiture", "Une maison"], "expected_answer": "Un café", "hint": None},
        {"say": "Très bien ! Répète : Je voudrais un café.", "exercise_type": "speak_repeat", "expected_answer": "Je voudrais un café", "hint": None},
        {"say": "Parfait ! À bientôt.", "exercise_type": "none", "expected_answer": None, "hint": None},
    ],
}
GENERIC_DIALOG = [
    {"say": "Hello!", "exercise_type": "none", "expected_answer": None, "hint": None},
    {"say": "Repeat after me.", "exercise_type": "speak_repeat", "expected_answer": "Hello", "hint": None},
]


class MockLLM:
    name, is_mock = "mock-llm", True

    def __init__(self, language_hint: str = "es"):
        self.language_hint = language_hint

    async def complete(self, system: str, messages: list[dict[str, str]], *, max_tokens: int, model_tier: str = "default") -> LLMResult:
        lang = "es"
        for code in MOCK_DIALOGS:  # Sprache aus dem Systemprompt-Code lesen, sonst Fallback
            if f"({code})" in system:
                lang = code
                break
        else:
            lang = self.language_hint if self.language_hint in MOCK_DIALOGS else ""
        script = MOCK_DIALOGS.get(lang, GENERIC_DIALOG)
        idx = min(sum(1 for m in messages if m["role"] == "user") - 1, len(script) - 1)
        turn = {k: v for k, v in script[max(idx, 0)].items() if v is not None}
        return LLMResult(json.dumps(turn, ensure_ascii=False), "mock", 0, 0, 0.0, True)


class MockSTT:
    name, is_mock = "mock-stt", True

    async def transcribe(self, audio: bytes, *, language_hint: str, mime: str = "audio/wav") -> STTResult:
        return STTResult("hola", language_hint, [{"word": "hola", "start": 0.0, "end": 0.5}], 0.5, 0.0, True)


def make_wav(duration_ms: int, sample_rate: int = 16000, freq: float = 220.0) -> bytes:
    n = int(sample_rate * duration_ms / 1000)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        frames = bytearray()
        for i in range(n):
            env = min(1.0, i / 400, (n - i) / 400)
            frames += struct.pack("<h", int(6000 * env * math.sin(2 * math.pi * freq * i / sample_rate)))
        w.writeframes(bytes(frames))
    return buf.getvalue()


class MockTTS:
    """Lokaler Test-TTS: erzeugt einen Ton (Dauer ~ Textlaenge) plus deterministische Visemes."""
    name, is_mock = "mock-tts", True

    async def synthesize(self, text: str, *, language: str, voice: str | None = None, speed: float = 1.0) -> TTSResult:
        duration = int(max(400, 65 * len(text)) / max(speed, 0.25))
        return TTSResult(make_wav(duration), "audio/wav", duration, text_to_visemes(text, duration), 0.0, True)


class MockPronunciation:
    name, is_mock = "mock-pron", True

    async def assess(self, audio: bytes, *, reference_text: str, language: str) -> PronResult:
        words = reference_text.split()
        scores = [{"word": w, "score": 70 + (sum(map(ord, w)) % 26)} for w in words]
        overall = round(sum(s["score"] for s in scores) / len(scores), 1) if scores else 0.0
        return PronResult(overall, scores, True)
