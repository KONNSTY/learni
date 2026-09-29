"""Provider-Fabrik: waehlt Mock automatisch, wenn Keys fehlen (kein Absturz, klare Liste)."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from ..config import RemoteConfig, Settings
from .base import LLMProvider, PronunciationProvider, STTProvider, TTSProvider
from .llm_gateway import GatewayLLM
from .mock import MockLLM, MockPronunciation, MockSTT, MockTTS
from .pronunciation import AzurePronunciation
from .stt import ElevenLabsSTT, GroqSTT
from .tts import AzureTTS, PiperTTS


@dataclass
class Providers:
    llm: LLMProvider
    stt: STTProvider
    stt_premium: STTProvider | None
    tts: TTSProvider
    pron: PronunciationProvider
    voices: dict[str, dict] = field(default_factory=dict)

    @property
    def mock_names(self) -> list[str]:
        names = {"llm": self.llm, "stt": self.stt, "tts": self.tts, "pronunciation": self.pron}
        return [k for k, v in names.items() if v.is_mock]


def load_voices(content_dir: Path) -> dict[str, dict]:
    data = json.loads((Path(content_dir) / "voices.json").read_text(encoding="utf-8"))
    return {k: v for k, v in data.items() if not k.startswith("_")}


def build_providers(s: Settings, cfg: RemoteConfig) -> Providers:
    voices = load_voices(s.content_dir)
    if s.llm_gateway_url and s.llm_api_key and s.llm_model_default:
        llm: LLMProvider = GatewayLLM(s.llm_gateway_url, s.llm_api_key,
                                      {"default": s.llm_model_default, "eval": s.llm_model_eval or s.llm_model_default,
                                       "premium": s.llm_model_premium or s.llm_model_default},
                                      s.llm_failover_models, float(cfg.get("costs", "llm_cents_per_1k_tokens", default=0.03)))
    else:
        llm = MockLLM()
    stt: STTProvider = GroqSTT(s.groq_api_key, usd_per_hour=float(cfg.get("costs", "groq_usd_per_hour", default=0.04))) if s.groq_api_key else MockSTT()
    stt_premium: STTProvider | None = ElevenLabsSTT(s.elevenlabs_api_key) if s.elevenlabs_api_key else None
    tts = _tts(s, voices)
    locales = {k: v["azure_locale"] for k, v in voices.items() if v.get("azure_locale")}
    pron: PronunciationProvider = AzurePronunciation(s.azure_speech_key, s.azure_speech_region, locales) if s.azure_speech_key else MockPronunciation()
    return Providers(llm, stt, stt_premium, tts, pron, voices)


def _tts(s: Settings, voices: dict[str, dict]) -> TTSProvider:
    choice = s.tts_provider
    if choice == "mock":
        return MockTTS()
    if choice in ("auto", "azure") and s.azure_speech_key:
        return AzureTTS(s.azure_speech_key, s.azure_speech_region, voices)
    if choice in ("auto", "piper") and s.piper_cmd and s.piper_model_dir:
        return PiperTTS(s.piper_cmd, s.piper_model_dir, voices)
    return MockTTS()
