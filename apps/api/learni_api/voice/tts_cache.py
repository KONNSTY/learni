"""TTS-Cache: Schluessel aus Text, Stimme, Sprache, Tempo. Nur EIGENES synthetisiertes Audio wird gecacht,
niemals Nutzeraudio. Pfadschema fuer CDN: <lang>/<voice>/<key>.<ext>."""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

from ..providers.base import TTSProvider, TTSResult

EXT = {"audio/mpeg": "mp3", "audio/wav": "wav"}


def cache_key(text: str, voice: str, language: str, speed: float) -> str:
    raw = f"{language}|{voice}|{round(speed, 2)}|{text.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def cdn_path(language: str, voice: str, key: str, ext: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_.-]", "_", voice)
    return f"{language}/{safe}/{key}.{ext}"


class TTSCache:
    def __init__(self, root: Path, public_base: str, tts: TTSProvider, voices: dict[str, dict], cdn_base: str = ""):
        self.root, self.public_base, self.tts, self.voices, self.cdn_base = Path(root), public_base.rstrip("/"), tts, voices, cdn_base.rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def voice_name(self, language: str) -> str:
        v = self.voices.get(language) or {}
        return v.get("azure") or v.get("piper") or "default"

    def url_for(self, rel: str) -> str:
        return f"{self.cdn_base}/{rel}" if self.cdn_base else f"{self.public_base}/v1/audio/{rel}"

    def find(self, language: str, text: str, speed: float) -> str | None:
        voice = self.voice_name(language)
        key = cache_key(text, voice, language, speed)
        for ext in EXT.values():
            rel = cdn_path(language, voice, key, ext)
            if (self.root / rel).exists():
                return rel
        return None

    async def get(self, text: str, language: str, speed: float = 1.0) -> tuple[str, TTSResult | None]:
        """Gibt (audio_url, frisches Ergebnis oder None bei Cache-Treffer) zurueck."""
        hit = self.find(language, text, speed)
        if hit:
            return self.url_for(hit), None
        res = await self.tts.synthesize(text, language=language, speed=speed)
        rel = cdn_path(language, self.voice_name(language), cache_key(text, self.voice_name(language), language, speed), EXT.get(res.mime, "bin"))
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(res.audio)
        return self.url_for(rel), res

    def resolve(self, rel: str) -> Path | None:
        p = (self.root / rel).resolve()
        if self.root.resolve() not in p.parents or not p.is_file():
            return None
        return p
