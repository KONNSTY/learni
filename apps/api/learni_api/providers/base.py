"""Provider-Interfaces. Per Config austauschbar; Mock-Adapter springen ein, wenn Keys fehlen."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class STTResult:
    text: str
    language: str
    words: list[dict[str, Any]] = field(default_factory=list)  # {word,start,end}
    confidence: float | None = None
    cost_cents: float = 0.0
    mock: bool = False


@dataclass
class LLMResult:
    text: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cost_cents: float = 0.0
    mock: bool = False


@dataclass
class TTSResult:
    audio: bytes
    mime: str
    duration_ms: int
    visemes: list[dict[str, int]] = field(default_factory=list)  # {t_ms, viseme 0..21}
    cost_cents: float = 0.0
    mock: bool = False


@dataclass
class PronResult:
    overall: float
    words: list[dict[str, Any]] = field(default_factory=list)  # {word,score}
    mock: bool = False


class LLMProvider(Protocol):
    name: str
    is_mock: bool

    async def complete(self, system: str, messages: list[dict[str, str]], *, max_tokens: int, model_tier: str = "default") -> LLMResult: ...


class STTProvider(Protocol):
    name: str
    is_mock: bool

    async def transcribe(self, audio: bytes, *, language_hint: str, mime: str = "audio/wav") -> STTResult: ...


class TTSProvider(Protocol):
    name: str
    is_mock: bool

    async def synthesize(self, text: str, *, language: str, voice: str | None = None, speed: float = 1.0) -> TTSResult: ...


class PronunciationProvider(Protocol):
    name: str
    is_mock: bool

    async def assess(self, audio: bytes, *, reference_text: str, language: str) -> PronResult: ...


class ProviderError(Exception):
    pass
