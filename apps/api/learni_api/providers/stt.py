"""STT-Adapter: Groq (Whisper Large v3 Turbo) und ElevenLabs Scribe. Sprache immer als Hint."""
from __future__ import annotations

import httpx

from .base import ProviderError, STTResult


class GroqSTT:
    name, is_mock = "groq-whisper", False
    URL = "https://api.groq.com/openai/v1/audio/transcriptions"

    def __init__(self, api_key: str, model: str = "whisper-large-v3-turbo", usd_per_hour: float = 0.04,
                 client: httpx.AsyncClient | None = None):
        self.key, self.model, self.usd_per_hour = api_key, model, usd_per_hour  # Preis [UNVERIFIZIERT]
        self.client = client or httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0))

    async def transcribe(self, audio: bytes, *, language_hint: str, mime: str = "audio/wav") -> STTResult:
        data = [("model", self.model), ("language", language_hint), ("response_format", "verbose_json"),
                ("timestamp_granularities[]", "word"), ("temperature", "0")]
        r = await self.client.post(self.URL, headers={"Authorization": f"Bearer {self.key}"}, data=data,
                                   files={"file": ("audio.wav", audio, mime)})
        if r.status_code >= 400:
            raise ProviderError(f"groq stt HTTP {r.status_code}")
        j = r.json()
        words = [{"word": w.get("word", ""), "start": w.get("start"), "end": w.get("end")} for w in j.get("words", [])]
        dur = float(j.get("duration") or 0)
        return STTResult(j.get("text", "").strip(), j.get("language", language_hint), words, None, dur / 3600 * self.usd_per_hour * 100, False)


class ElevenLabsSTT:
    name, is_mock = "elevenlabs-scribe", False
    URL = "https://api.elevenlabs.io/v1/speech-to-text"

    def __init__(self, api_key: str, model_id: str = "scribe_v1", usd_per_hour: float = 0.4, client: httpx.AsyncClient | None = None):
        self.key, self.model_id, self.usd_per_hour = api_key, model_id, usd_per_hour  # Modell-ID/Preis [UNVERIFIZIERT]
        self.client = client or httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))

    async def transcribe(self, audio: bytes, *, language_hint: str, mime: str = "audio/wav") -> STTResult:
        r = await self.client.post(self.URL, headers={"xi-api-key": self.key},
                                   data={"model_id": self.model_id, "language_code": language_hint},
                                   files={"file": ("audio.wav", audio, mime)})
        if r.status_code >= 400:
            raise ProviderError(f"elevenlabs stt HTTP {r.status_code}")
        j = r.json()
        words = [{"word": w.get("text", ""), "start": w.get("start"), "end": w.get("end")} for w in j.get("words", []) if w.get("type", "word") == "word"]
        dur = words[-1]["end"] if words and words[-1].get("end") else 0.0
        return STTResult(j.get("text", "").strip(), j.get("language_code", language_hint), words, j.get("language_probability"), float(dur) / 3600 * self.usd_per_hour * 100, False)
