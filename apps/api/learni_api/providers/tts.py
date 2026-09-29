"""TTS-Adapter: Azure Neural (REST), ElevenLabs, Piper (lokaler Open-Source-Fallback)."""
from __future__ import annotations

import asyncio
import io
import wave
from pathlib import Path
from xml.sax.saxutils import escape

import httpx

from .base import ProviderError, TTSResult
from .visemes import text_to_visemes


def _mp3_duration_ms(text: str, speed: float) -> int:
    return int(max(400, 65 * len(text)) / max(speed, 0.25))


class AzureTTS:
    """REST liefert keine Viseme-Events: Visemes aus Text-Heuristik. Fuer echte Viseme-Zeitstempel das
    Speech-SDK (VisemeReceived) nutzen -> docs/SETUP_ANLEITUNG.md. [UNVERIFIZIERT: Preis/Locale-Abdeckung]"""
    name, is_mock = "azure-tts", False

    def __init__(self, key: str, region: str, voices: dict[str, dict], usd_per_million_chars: float = 15.0,
                 client: httpx.AsyncClient | None = None):
        self.key, self.region, self.voices, self.price = key, region, voices, usd_per_million_chars
        self.client = client or httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0))

    @property
    def url(self) -> str:
        return f"https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1"

    def ssml(self, text: str, voice: str, locale: str, speed: float) -> str:
        rate = f"{int(round((speed - 1.0) * 100)):+d}%"
        return (f"<speak version='1.0' xml:lang='{escape(locale)}'><voice name='{escape(voice)}'>"
                f"<prosody rate='{rate}'>{escape(text)}</prosody></voice></speak>")

    async def synthesize(self, text: str, *, language: str, voice: str | None = None, speed: float = 1.0) -> TTSResult:
        v = self.voices.get(language)
        if not v or not v.get("azure"):
            raise ProviderError(f"no azure voice for {language}")
        r = await self.client.post(self.url, content=self.ssml(text, voice or v["azure"], v["azure_locale"], speed).encode("utf-8"),
                                   headers={"Ocp-Apim-Subscription-Key": self.key, "Content-Type": "application/ssml+xml",
                                            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "learni-api"})
        if r.status_code >= 400:
            raise ProviderError(f"azure tts HTTP {r.status_code}")
        dur = _mp3_duration_ms(text, speed)
        return TTSResult(r.content, "audio/mpeg", dur, text_to_visemes(text, dur), len(text) / 1e6 * self.price * 100, False)


class ElevenLabsTTS:
    name, is_mock = "elevenlabs-tts", False

    def __init__(self, key: str, voice_ids: dict[str, str], model_id: str = "eleven_multilingual_v2",
                 usd_per_1k_chars: float = 0.18, client: httpx.AsyncClient | None = None):
        self.key, self.voice_ids, self.model_id, self.price = key, voice_ids, model_id, usd_per_1k_chars  # [UNVERIFIZIERT]
        self.client = client or httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))

    async def synthesize(self, text: str, *, language: str, voice: str | None = None, speed: float = 1.0) -> TTSResult:
        vid = voice or self.voice_ids.get(language)
        if not vid:
            raise ProviderError(f"no elevenlabs voice for {language}")
        r = await self.client.post(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}", params={"output_format": "mp3_44100_128"},
                                   headers={"xi-api-key": self.key}, json={"text": text, "model_id": self.model_id,
                                                                            "voice_settings": {"speed": speed}} if speed != 1.0 else {"text": text, "model_id": self.model_id})
        if r.status_code >= 400:
            raise ProviderError(f"elevenlabs tts HTTP {r.status_code}")
        dur = _mp3_duration_ms(text, speed)
        return TTSResult(r.content, "audio/mpeg", dur, text_to_visemes(text, dur), len(text) / 1000 * self.price * 100, False)


class PiperTTS:
    """Lokaler Open-Source-TTS (CLI `piper`), Dev-Fallback und Kostenbremse. Kein Shell-Aufruf."""
    name, is_mock = "piper-tts", False

    def __init__(self, cmd: str, model_dir: str, voices: dict[str, dict]):
        self.cmd, self.model_dir, self.voices = cmd, Path(model_dir), voices

    def available_languages(self) -> list[str]:
        return [lang for lang, v in self.voices.items() if v.get("piper") and (self.model_dir / f"{v['piper']}.onnx").exists()]

    async def synthesize(self, text: str, *, language: str, voice: str | None = None, speed: float = 1.0) -> TTSResult:
        name = voice or (self.voices.get(language) or {}).get("piper")
        model = self.model_dir / f"{name}.onnx" if name else None
        if not model or not model.exists():
            raise ProviderError(f"no piper model for {language}")
        out = self.model_dir / f".tmp-{abs(hash((text, language, speed)))}.wav"
        proc = await asyncio.create_subprocess_exec(self.cmd, "--model", str(model), "--length_scale", str(round(1 / max(speed, 0.25), 3)),
                                                    "--output_file", str(out), stdin=asyncio.subprocess.PIPE,
                                                    stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
        await proc.communicate(text.encode("utf-8"))
        if proc.returncode != 0 or not out.exists():
            raise ProviderError("piper failed")
        try:
            audio = out.read_bytes()
        finally:
            out.unlink(missing_ok=True)
        with wave.open(io.BytesIO(audio)) as w:
            dur = int(w.getnframes() / w.getframerate() * 1000)
        return TTSResult(audio, "audio/wav", dur, text_to_visemes(text, dur), 0.0, False)
