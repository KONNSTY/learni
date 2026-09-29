"""Request-Modelle (Pydantic). Spiegeln packages/contracts/openapi.yaml; `extra=forbid` gegen Mass-Assignment."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Lang = Annotated[str, StringConstraints(pattern=r"^[a-z]{2,3}(-[A-Z]{2})?$")]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AuthSyncRequest(Strict):
    native_language: Lang | None = None
    ui_language: Literal["de", "en"] | None = None
    display_name: Annotated[str, StringConstraints(max_length=60)] | None = None


class SettingsPatch(Strict):
    avatar_voice: bool | None = None
    sfx: bool | None = None
    haptics: bool | None = None
    show_translation: bool | None = None
    auto_vad: bool | None = None


class ConsentsPatch(Strict):
    voice_processing: bool | None = None
    personalized_ads: bool | None = None
    analytics: bool | None = None


class ProfilePatch(Strict):
    display_name: Annotated[str, StringConstraints(max_length=60)] | None = None
    native_language: Lang | None = None
    ui_language: Literal["de", "en"] | None = None
    age_bracket: Literal["under_16", "16_17", "18_plus"] | None = None
    settings: SettingsPatch | None = None
    consents: ConsentsPatch | None = None


class AdaptiveAnswer(Strict):
    item_id: str = Field(max_length=80)
    correct: bool


class OnboardingRequest(Strict):
    language: Lang
    self_level: Literal["none", "few_words", "simple_conversations", "everyday"]
    adaptive_answers: list[AdaptiveAnswer] = Field(default_factory=list, max_length=5)
    goal: Literal["travel", "work", "family", "fun"]
    daily_goal_minutes: Literal[5, 10, 15, 20]


class NextExerciseRequest(Strict):
    language: Lang
    mode: Literal["curriculum", "conversation"] = "curriculum"


class AnswerRequest(Strict):
    language: Lang
    answer: str | list[str] = Field(max_length=2000)
    response_ms: int | None = Field(default=None, ge=0, le=600000)
    pronunciation_score: float | None = Field(default=None, ge=0, le=100)


class LessonCompleteRequest(Strict):
    language: Lang
    xp: int = Field(ge=0, le=500)
    mistakes: int = Field(ge=0, le=1000)
    minutes: float = Field(ge=0, le=120)


class VoiceTurnRequest(Strict):
    language: Lang
    audio_b64: str | None = Field(default=None, max_length=8_000_000)
    audio_seconds: float = Field(default=0.0, ge=0, le=60)
    audio_mime: Literal["audio/wav", "audio/mp4", "audio/mpeg", "audio/webm", "audio/ogg"] = "audio/wav"
    text: str | None = Field(default=None, max_length=500)
    slow: bool = False
    exercise_id: str | None = Field(default=None, max_length=80)
    scenario_id: str | None = Field(default=None, pattern=r"^[a-z0-9_]{1,40}$")


class AnalyticsEvent(Strict):
    name: Literal["app_open", "trial_start", "trial_converted", "purchase", "ad_impression", "lesson_complete", "voice_turn", "error", "paywall_shown"]
    language: Lang | None = None
    props: dict[str, str | int | float | bool | None] = Field(default_factory=dict, max_length=20)


class DevMembership(Strict):
    tier: Literal["free", "pro"]
