"""Voice-Pipeline: (VAD/Client) -> STT -> Guardrails -> LLM -> satzweises TTS -> Events.

Audio wird nur im Speicher verarbeitet und nie persistiert. Latenz je Stufe wird gemessen (p50/p95).
"""
from __future__ import annotations

import asyncio
import io
import logging
import re
import struct
import time
import wave
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any

from ..events import ev
from ..guardrails import (
    GuardrailError,
    cap_tokens,
    check_vocab,
    detect_injection,
    moderate,
    off_topic,
    sanitize_user_text,
    validate_llm_turn,
    wrap_user_text,
)
from ..providers.base import ProviderError
from .tts_cache import TTSCache

log = logging.getLogger("learni.voice")

HALLUCINATIONS = {
    "thanks for watching", "thank you for watching", "gracias por ver el video", "gracias por ver el vídeo",
    "untertitel der amara.org-community", "untertitel im auftrag des zdf", "sous-titres réalisés para la communauté d'amara.org",
    "sous-titrage st' 501", "altyazı m.k.", "terima kasih telah menonton", "hvala što ste gledali",
}
SENTENCE_RE = re.compile(r"(?<=[.!?…])\s+")
LLM_TURN_TYPES_ALLOWED = {"multiple_choice", "speak_repeat", "flashcard", "none"}


class CancelToken:
    """Barge-in: der Client unterbricht den Tutor -> weitere Stufen werden uebersprungen."""
    def __init__(self) -> None:
        self.cancelled = False

    def cancel(self) -> None:
        self.cancelled = True


class LatencyTracker:
    def __init__(self, window: int = 500):
        self.samples: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=window))

    def record(self, stage: str, ms: float) -> None:
        self.samples[stage].append(ms)

    def percentile(self, stage: str, p: float) -> float | None:
        s = sorted(self.samples.get(stage, []))
        if not s:
            return None
        return s[min(len(s) - 1, int(round(p / 100 * (len(s) - 1))))]

    def snapshot(self) -> dict[str, dict[str, float | None]]:
        return {st: {"p50": self.percentile(st, 50), "p95": self.percentile(st, 95), "n": len(v)} for st, v in self.samples.items()}


def audio_rms(wav_bytes: bytes) -> float | None:
    try:
        with wave.open(io.BytesIO(wav_bytes)) as w:
            if w.getsampwidth() != 2:
                return None
            frames = w.readframes(w.getnframes())
        n = len(frames) // 2
        if n == 0:
            return 0.0
        samples = struct.unpack(f"<{n}h", frames[: n * 2])
        return (sum(s * s for s in samples) / n) ** 0.5
    except (wave.Error, struct.error, EOFError):
        return None


def hallucination_filter(text: str, audio_seconds: float, rms: float | None) -> str:
    """Verwirft typische Whisper-Halluzinationen bei Stille/sehr kurzem Audio."""
    t = re.sub(r"[^\w\s'.-]", "", text.lower()).strip().rstrip(".")
    quiet = (rms is not None and rms < 120) or audio_seconds < 0.4
    if t in HALLUCINATIONS or (quiet and len(t.split()) > 2):
        return ""
    return text.strip()


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in SENTENCE_RE.split(text.strip()) if s.strip()]


@dataclass
class TurnInput:
    user_id: str
    language: str
    level: str
    ui_language: str
    tier: str
    regional_tier: str = "tier1"
    audio: bytes | None = None
    audio_seconds: float = 0.0
    text: str | None = None
    slow: bool = False
    reference_text: str | None = None  # bei speak_repeat: Aussprache bewerten
    scenario_id: str | None = None
    tutor_profile: dict[str, Any] | None = None
    premium_stt: bool = False


@dataclass
class TurnResult:
    transcript: str
    events: list[dict[str, Any]]
    latency_ms: dict[str, float]
    tutor_turn: dict[str, Any] | None = None
    pronunciation: dict[str, Any] | None = None
    cost_cents: float = 0.0
    seconds: float = 0.0
    mock: bool = False
    cancelled: bool = False
    fallback: bool = False


class ConversationBuffer:
    """Fluechtiger Gespraechsverlauf (nur RAM, begrenzt, nicht persistiert)."""
    def __init__(self, max_messages: int = 8):
        self.max = max_messages
        self.data: dict[tuple[str, str], list[dict[str, str]]] = {}

    def get(self, user_id: str, language: str) -> list[dict[str, str]]:
        return list(self.data.get((user_id, language), []))

    def add(self, user_id: str, language: str, role: str, content: str) -> None:
        msgs = self.data.setdefault((user_id, language), [])
        msgs.append({"role": role, "content": content})
        del msgs[: -self.max]

    def clear(self, user_id: str) -> None:
        for k in [k for k in self.data if k[0] == user_id]:
            del self.data[k]


class VoicePipeline:
    def __init__(self, providers: Any, prompts: Any, lib: Any, tts_cache: TTSCache, cfg: Any, latency: LatencyTracker | None = None,
                 buffer: ConversationBuffer | None = None):
        self.p, self.prompts, self.lib, self.tts_cache, self.cfg = providers, prompts, lib, tts_cache, cfg
        self.latency = latency or LatencyTracker()
        self.buffer = buffer or ConversationBuffer()

    async def _timed(self, stage: str, timings: dict[str, float], coro: Any) -> Any:
        t0 = time.perf_counter()
        try:
            return await coro
        finally:
            ms = (time.perf_counter() - t0) * 1000
            timings[stage] = round(ms, 1)
            self.latency.record(stage, ms)

    def _speak_event(self, text: str, audio_url: str | None, visemes: list[dict], emotion: str, mock: bool) -> dict[str, Any]:
        return ev("avatar.speak", {"text": text, "audio_url": audio_url, "visemes": visemes, "emotion": emotion, "mock": mock})

    async def turn(self, inp: TurnInput, cancel: CancelToken | None = None) -> TurnResult:
        cancel = cancel or CancelToken()
        t_start = time.perf_counter()
        timings: dict[str, float] = {}
        events: list[dict[str, Any]] = []
        cost, mock = 0.0, False
        lang_max = int(self.cfg.get("voice", "max_audio_seconds", default=30))
        seconds = min(inp.audio_seconds or 3.0, lang_max)

        # 1) STT (Sprach-Hint = Lernsprache; erkannt wird nur die Muttersprache anderswo)
        transcript = sanitize_user_text(inp.text or "", 500)
        if inp.audio:
            stt = inp.premium_stt and self.p.stt_premium or self.p.stt
            try:
                res = await self._timed("stt", timings, stt.transcribe(inp.audio, language_hint=inp.language))
                cost += res.cost_cents
                mock = mock or res.mock
                transcript = sanitize_user_text(hallucination_filter(res.text, inp.audio_seconds, audio_rms(inp.audio)), 500)
            except (ProviderError, OSError) as e:
                log.warning("stt failed: %s", type(e).__name__)
                transcript = ""
        if cancel.cancelled:
            return TurnResult(transcript, events, timings, cancelled=True, seconds=seconds, cost_cents=cost, mock=mock)
        if not transcript:
            events.append(ev("avatar.speak", {"text": "", "audio_url": None, "visemes": [{"t_ms": 0, "viseme": 0}], "emotion": "thinking", "mock": mock}))
            return TurnResult("", events, self._finish(timings, t_start), seconds=seconds, cost_cents=cost, mock=mock)

        # 2) Aussprache (nur bei Sprechuebung; nie Herzen)
        pron = None
        if inp.audio and inp.reference_text:
            try:
                pr = await self._timed("pronunciation", timings, self.p.pron.assess(inp.audio, reference_text=inp.reference_text, language=inp.language))
                pron, mock = {"overall": pr.overall, "words": pr.words}, mock or pr.mock
            except (ProviderError, OSError) as e:
                log.warning("pronunciation failed: %s", type(e).__name__)

        # 3) Guardrails auf Nutzertext
        safe_reply = self._input_guard(transcript, inp)
        if safe_reply:
            turn = safe_reply
        else:
            turn, llm_cost, llm_mock = await self._llm_turn(inp, transcript, timings)
            cost += llm_cost
            mock = mock or llm_mock
        if cancel.cancelled:
            return TurnResult(transcript, events, self._finish(timings, t_start), turn, pron, cost, seconds, mock, True)

        # 4) Satzweises TTS (parallel, Reihenfolge bleibt) + Visemes
        speed = 0.8 if inp.slow else 1.0
        sentences = split_sentences(turn["say"])[:3] or [turn["say"]]
        try:
            results = await self._timed("tts", timings, asyncio.gather(*[self.tts_cache.get(s, inp.language, speed) for s in sentences]))
        except (ProviderError, OSError) as e:
            log.warning("tts failed: %s", type(e).__name__)
            results = []
        offset = 0
        for sent, (url, fresh) in zip(sentences, results, strict=False):
            if cancel.cancelled:
                break
            vis = [{"t_ms": v["t_ms"] + offset, "viseme": v["viseme"]} for v in fresh.visemes] if fresh else _estimate_visemes(sent, offset)
            dur = fresh.duration_ms if fresh else max(400, 65 * len(sent))
            cost += fresh.cost_cents if fresh else 0.0
            mock = mock or bool(fresh and fresh.mock)
            events.append(self._speak_event(sent, url, vis, "encouraging" if turn["exercise_type"] != "none" else "happy", bool(fresh.mock) if fresh else mock))
            offset += dur
        if not results:
            events.append(self._speak_event(turn["say"], None, [{"t_ms": 0, "viseme": 0}], "neutral", mock))

        self.buffer.add(inp.user_id, inp.language, "user", wrap_user_text(transcript))
        self.buffer.add(inp.user_id, inp.language, "assistant", turn["say"])
        total = self._finish(timings, t_start)
        if total["total"] > float(self.cfg.get("voice", "latency_alarm_ms", default=2000)):
            log.warning("voice latency alarm total=%sms stages=%s", total["total"], timings)
        return TurnResult(transcript, events, total, turn, pron, cost, seconds, mock, cancel.cancelled)

    def _finish(self, timings: dict[str, float], t_start: float) -> dict[str, float]:
        total = round((time.perf_counter() - t_start) * 1000, 1)
        self.latency.record("total", total)
        return {**timings, "total": total}

    def _input_guard(self, text: str, inp: TurnInput) -> dict[str, Any] | None:
        cat = moderate(text)
        if cat == "self_harm":
            return {"say": "Es tut mir leid, dass es dir schlecht geht. Bitte sprich mit jemandem, dem du vertraust, oder wähle den Notruf deines Landes.", "exercise_type": "none", "expected_answer": None, "hint": None, "guard": "moderation"}
        if cat or detect_injection(text) or off_topic(text):
            return {"say": _redirect(inp.language), "exercise_type": "none", "expected_answer": None, "hint": None, "guard": "topic"}
        return None

    async def _llm_turn(self, inp: TurnInput, transcript: str, timings: dict[str, float]) -> tuple[dict[str, Any], float, bool]:
        max_out = int(self.cfg.get("llm", "max_output_tokens", default=220))
        vocab = sorted(self.lib.vocabulary_whitelist(inp.language, inp.level))
        system = self.prompts.system_prompt(language=inp.language, level=inp.level, ui_language=inp.ui_language,
                                            tutor_profile=inp.tutor_profile, scenario_id=inp.scenario_id, vocabulary=vocab)
        history = self.buffer.get(inp.user_id, inp.language)
        messages = [*history, {"role": "user", "content": wrap_user_text(cap_tokens(transcript, int(self.cfg.get("llm", "max_input_tokens", default=600))))}]
        tier = "premium" if inp.tier == "pro" and inp.premium_stt else "default"
        cost, mock = 0.0, False
        for attempt in range(2):
            try:
                res = await self._timed("llm", timings, self.p.llm.complete(system, messages, max_tokens=max_out, model_tier=tier))
                cost += res.cost_cents
                mock = mock or res.mock
                turn = validate_llm_turn(res.text)
                if turn["exercise_type"] not in LLM_TURN_TYPES_ALLOWED:
                    turn["exercise_type"] = "none"
                if not res.mock and check_vocab(turn["say"], set(vocab), inp.level):
                    raise GuardrailError("vocab", "outside level whitelist")
                return turn, cost, mock
            except (GuardrailError, ProviderError, OSError) as e:
                log.warning("llm turn attempt %s failed: %s", attempt, getattr(e, "code", type(e).__name__))
        return {"say": _redirect(inp.language), "exercise_type": "none", "expected_answer": None, "hint": None, "guard": "fallback"}, cost, mock


def _redirect(language: str) -> str:
    return {"es": "Volvamos a practicar. ¿Repetimos una frase?", "fr": "Revenons à l'exercice. On répète une phrase ?", "en": "Let's get back to practicing. Shall we repeat a sentence?"}.get(language, "Let's practice. Repeat after me: hello.")


def _estimate_visemes(sent: str, offset: int) -> list[dict[str, int]]:
    from ..providers.visemes import text_to_visemes
    dur = max(400, 65 * len(sent))
    return [{"t_ms": v["t_ms"] + offset, "viseme": v["viseme"]} for v in text_to_visemes(sent, dur)]
