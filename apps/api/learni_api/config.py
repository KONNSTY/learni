"""Konfiguration: Env-Variablen (Secrets) + remote_config.json (Werte, A/B-testbar)."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

PKG_DIR = Path(__file__).parent
REPO_ROOT = PKG_DIR.parent.parent.parent


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _flag(name: str, default: bool) -> bool | None:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return None
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    app_env: str = "dev"
    public_base_url: str = "http://localhost:8000"
    cors_origins: list[str] = field(default_factory=list)
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""
    redis_url: str = ""
    llm_gateway_url: str = ""
    llm_api_key: str = ""
    llm_model_default: str = ""
    llm_model_eval: str = ""
    llm_model_premium: str = ""
    llm_failover_models: list[str] = field(default_factory=list)
    groq_api_key: str = ""
    elevenlabs_api_key: str = ""
    azure_speech_key: str = ""
    azure_speech_region: str = "westeurope"
    tts_provider: str = "auto"
    piper_cmd: str = ""
    piper_model_dir: str = ""
    revenuecat_webhook_secret: str = ""
    n8n_base_url: str = ""
    n8n_webhook_secret: str = ""
    content_dir: Path = REPO_ROOT / "content"
    flag_overrides: dict[str, bool] = field(default_factory=dict)

    @property
    def is_dev(self) -> bool:
        return self.app_env == "dev"

    @property
    def allow_draft_content(self) -> bool:
        """Draft-Content nur im Testmodus (nie in prod)."""
        return self.app_env != "prod"

    @classmethod
    def from_env(cls) -> Settings:
        flags = {}
        for key in ("bot_protection", "captcha", "require_email_verification", "login_rate_limits"):
            v = _flag("FLAG_" + key.upper(), False)
            if v is not None:
                flags[key] = v
        return cls(
            app_env=_env("APP_ENV", "dev"),
            public_base_url=_env("PUBLIC_BASE_URL", "http://localhost:8000"),
            cors_origins=[o for o in _env("CORS_ORIGINS").split(",") if o],
            supabase_url=_env("SUPABASE_URL"),
            supabase_jwt_secret=_env("SUPABASE_JWT_SECRET"),
            supabase_service_role_key=_env("SUPABASE_SERVICE_ROLE_KEY"),
            redis_url=_env("REDIS_URL"),
            llm_gateway_url=_env("LLM_GATEWAY_URL"),
            llm_api_key=_env("LLM_API_KEY"),
            llm_model_default=_env("LLM_MODEL_DEFAULT"),
            llm_model_eval=_env("LLM_MODEL_EVAL"),
            llm_model_premium=_env("LLM_MODEL_PREMIUM"),
            llm_failover_models=[m for m in _env("LLM_FAILOVER_MODELS").split(",") if m],
            groq_api_key=_env("GROQ_API_KEY"),
            elevenlabs_api_key=_env("ELEVENLABS_API_KEY"),
            azure_speech_key=_env("AZURE_SPEECH_KEY"),
            azure_speech_region=_env("AZURE_SPEECH_REGION", "westeurope"),
            tts_provider=_env("TTS_PROVIDER", "auto"),
            piper_cmd=_env("PIPER_CMD"),
            piper_model_dir=_env("PIPER_MODEL_DIR"),
            revenuecat_webhook_secret=_env("REVENUECAT_WEBHOOK_SECRET"),
            n8n_base_url=_env("N8N_BASE_URL"),
            n8n_webhook_secret=_env("N8N_WEBHOOK_SECRET"),
            content_dir=Path(_env("CONTENT_DIR") or REPO_ROOT / "content"),
            flag_overrides=flags,
        )

    def missing_keys(self) -> list[str]:
        """Klare Warnliste beim Start (kein Absturz, Mocks springen ein)."""
        checks = {
            "SUPABASE_URL / SUPABASE_JWT_SECRET (Auth, Persistenz -> MemoryStore/Dev-Auth)": self.supabase_url and self.supabase_jwt_secret,
            "LLM_GATEWAY_URL + LLM_API_KEY + LLM_MODEL_DEFAULT (LLM -> Mock-Tutor)": self.llm_gateway_url and self.llm_api_key and self.llm_model_default,
            "GROQ_API_KEY (STT -> Mock-STT)": self.groq_api_key,
            "AZURE_SPEECH_KEY (TTS/Aussprache -> lokaler/Mock-TTS)": self.azure_speech_key,
            "REVENUECAT_WEBHOOK_SECRET (Webhook deaktiviert)": self.revenuecat_webhook_secret,
        }
        return [k for k, ok in checks.items() if not ok]


@lru_cache(maxsize=1)
def _remote_defaults() -> dict[str, Any]:
    return json.loads((PKG_DIR / "remote_config.json").read_text(encoding="utf-8"))


class RemoteConfig:
    """Werte aus remote_config.json; `flag_overrides` (Env) schlagen die Datei."""

    def __init__(self, settings: Settings, data: dict[str, Any] | None = None):
        self.data: dict[str, Any] = json.loads(json.dumps(data or _remote_defaults()))
        self.data["feature_flags"].update(settings.flag_overrides)

    def get(self, *path: str, default: Any = None) -> Any:
        cur: Any = self.data
        for p in path:
            if not isinstance(cur, dict) or p not in cur:
                return default
            cur = cur[p]
        return cur

    def tier(self, tier: str) -> dict[str, Any]:
        return self.data["pro" if tier == "pro" else "free"]

    def flag(self, name: str) -> bool:
        return bool(self.data["feature_flags"].get(name, False))

    def public(self) -> dict[str, Any]:
        """Nur Werte, die der Client kennen darf (keine Kostenlimits)."""
        d = self.data
        return {
            "version": d["version"],
            "pricing": d["pricing"],
            "free": {k: d["free"][k] for k in ("max_hearts", "heart_regen_minutes", "roleplay", "ads", "ai_seconds_per_day")},
            "pro": {k: d["pro"][k] for k in ("max_hearts", "roleplay", "ads", "ai_seconds_per_day")},
            "voice": d["voice"],
            "feature_flags": d["feature_flags"],
        }
