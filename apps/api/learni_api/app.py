"""FastAPI-Anwendung (Orchestrator-Backend)."""
from __future__ import annotations

import base64
import binascii
import logging
import os
import tempfile
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import schemas as M
from .auth import AuthUser, current_user
from .config import RemoteConfig, Settings
from .content import ContentLibrary
from .events import ev
from .prompts import PromptLibrary
from .providers.factory import Providers, build_providers
from .security import RateLimiter, SecurityHeadersMiddleware, enforce, safe_compare
from .service import DomainError, Service
from .store import MemoryStore, Store
from .voice.pipeline import LatencyTracker, TurnInput, VoicePipeline
from .voice.tts_cache import TTSCache

log = logging.getLogger("learni.api")
VERSION = "1.0.0"


def create_app(settings: Settings | None = None, store: Store | None = None, providers: Providers | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    cfg = RemoteConfig(settings)
    lib = ContentLibrary(settings.content_dir, settings.allow_draft_content)
    if store is None:
        if settings.supabase_url and settings.supabase_service_role_key:
            from .store_postgrest import PostgrestStore
            store = PostgrestStore(settings.supabase_url, settings.supabase_service_role_key)
        else:
            store = MemoryStore()
    providers = providers or build_providers(settings, cfg)
    prompts = PromptLibrary(settings.content_dir)
    cache_root = Path(os.environ.get("AUDIO_CACHE_DIR") or (Path(tempfile.gettempdir()) / "learni-audio-cache"))
    tts_cache = TTSCache(cache_root, settings.public_base_url, providers.tts, providers.voices, os.environ.get("AUDIO_CDN_BASE", ""))
    latency = LatencyTracker()
    svc = Service(store, cfg, lib)
    pipeline = VoicePipeline(providers, prompts, lib, tts_cache, cfg, latency)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        missing = settings.missing_keys()
        if missing:
            log.warning("Fehlende Konfiguration (Mock-/Dev-Fallbacks aktiv):\n  - " + "\n  - ".join(missing))
        yield

    app = FastAPI(title="Learni API", version=VERSION, lifespan=lifespan, docs_url="/docs" if settings.is_dev else None, redoc_url=None, openapi_url="/openapi.json" if settings.is_dev else None)
    app.state.settings, app.state.cfg, app.state.store, app.state.svc = settings, cfg, store, svc
    app.state.providers, app.state.pipeline, app.state.latency, app.state.limiter = providers, pipeline, latency, RateLimiter()
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"], max_age=600)

    @app.exception_handler(DomainError)
    async def _domain(_: Request, exc: DomainError):
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": exc.detail}, status_code=exc.status)

    User = Depends(current_user)

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", "mock_providers": providers.mock_names, "version": VERSION}

    @app.get("/v1/config")
    def get_config() -> dict[str, Any]:
        return cfg.public()

    @app.get("/v1/languages")
    def languages() -> list[dict[str, Any]]:
        return lib.languages

    @app.post("/v1/auth/sync")
    def auth_sync(body: M.AuthSyncRequest, request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id)
        svc.ensure_user(user.user_id, native_language=body.native_language, ui_language=body.ui_language, display_name=body.display_name)
        return svc.state(user.user_id, "es")

    @app.get("/v1/profile")
    def get_profile(request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id)
        return svc.profile_public(svc.ensure_user(user.user_id))

    @app.patch("/v1/profile")
    def patch_profile(body: M.ProfilePatch, request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id)
        return svc.patch_profile(user.user_id, body.model_dump(exclude_none=True))

    @app.post("/v1/onboarding")
    def onboarding(body: M.OnboardingRequest, request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id)
        return svc.onboarding(user.user_id, body.model_dump())

    @app.get("/v1/state")
    def state(language: str, request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id)
        return svc.state(user.user_id, _lang(language))

    @app.get("/v1/plan")
    def plan(language: str, request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id)
        return svc.plan(user.user_id, _lang(language))

    @app.post("/v1/exercises/next")
    def next_exercise(body: M.NextExerciseRequest, request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id, "exercise")
        res = svc.next_exercise(user.user_id, body.language)
        res["events"] += svc.budget_events(user.user_id) if body.mode == "conversation" else []
        return res

    @app.post("/v1/exercises/{exercise_id}/answer")
    def answer(exercise_id: str, body: M.AnswerRequest, request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id, "exercise")
        return {"events": svc.answer(user.user_id, exercise_id, body.language, body.answer, body.response_ms, body.pronunciation_score)}

    @app.post("/v1/lessons/complete")
    def lesson_complete(body: M.LessonCompleteRequest, request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id)
        return {"events": svc.complete_lesson(user.user_id, body.language, body.mistakes, body.minutes)}

    @app.post("/v1/ads/rewarded")
    def rewarded(request: Request, language: str = "es", user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id)
        return {"events": svc.rewarded_ad(user.user_id, _lang(language))}

    @app.post("/v1/voice/turn")
    async def voice_turn(body: M.VoiceTurnRequest, request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id, "voice")
        prof = svc.ensure_user(user.user_id)
        if body.audio_b64 and not prof["consents"].get("voice_processing"):
            raise HTTPException(403, "consent_required: voice_processing")
        limited = svc.budget_events(user.user_id)
        if limited:  # Kill-Switch/Budget: sauberer Fallback auf gecachten Content, kein KI-Aufruf
            return {"transcript": "", "events": limited, "latency_ms": {}, "test_mode": bool(providers.mock_names)}
        tier = svc.tier(user.user_id)
        events: list[dict[str, Any]] = []
        if body.scenario_id:
            scen = pipeline.prompts.scenario(body.scenario_id)
            if not scen:
                raise HTTPException(404, "unknown scenario")
            if scen.get("pro_only") and not cfg.tier(tier)["roleplay"]:
                return {"transcript": "", "events": [ev("paywall.requested", {"trigger": "pro_feature"})], "latency_ms": {}, "test_mode": bool(providers.mock_names)}
        audio = None
        if body.audio_b64:
            try:
                audio = base64.b64decode(body.audio_b64, validate=True)
            except (binascii.Error, ValueError):
                raise HTTPException(422, "invalid audio_b64") from None
        if not audio and not body.text:
            raise HTTPException(422, "audio or text required")
        row = svc.learner(user.user_id, body.language)
        reference = None
        if body.exercise_id:
            issued = svc.store.get("issued_exercises", user_id=user.user_id, exercise_id=body.exercise_id)
            if issued and issued["type"] == "speak_repeat" and isinstance(issued.get("expected_answer"), str):
                reference = issued["expected_answer"]
        inp = TurnInput(user.user_id, body.language, row["level"], prof["ui_language"], tier, svc.membership(user.user_id).get("regional_tier", "tier1"),
                        audio, body.audio_seconds, body.text, body.slow, reference, body.scenario_id, svc.tutor_profile(user.user_id, body.language),
                        premium_stt=tier == "pro")
        res = await pipeline.turn(inp)
        svc.budget.charge(user.user_id, res.seconds, res.cost_cents)
        events += res.events
        out: dict[str, Any] = {"transcript": res.transcript, "events": events, "latency_ms": res.latency_ms, "test_mode": res.mock or bool(providers.mock_names)}
        if res.pronunciation:
            out["pronunciation"] = res.pronunciation
        if res.tutor_turn and res.tutor_turn["exercise_type"] != "none":
            ex_id = "ex_llm_" + base64.urlsafe_b64encode(os.urandom(6)).decode().rstrip("=")
            out["tutor_turn"] = svc.issue_tutor_exercise(user.user_id, body.language, row["level"], res.tutor_turn, ex_id)
        return out

    @app.get("/v1/tutor-profile")
    def get_tutor_profile(language: str, request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id)
        return svc.tutor_profile(user.user_id, _lang(language))

    @app.delete("/v1/tutor-profile", status_code=204)
    def del_tutor_profile(language: str, request: Request, user: AuthUser = User) -> Response:
        enforce(request, user.user_id)
        svc.delete_tutor_profile(user.user_id, _lang(language))
        return Response(status_code=204)

    @app.get("/v1/export")
    def export(request: Request, user: AuthUser = User) -> dict[str, Any]:
        enforce(request, user.user_id)
        return svc.export(user.user_id)

    @app.delete("/v1/account", status_code=204)
    def delete_account(request: Request, user: AuthUser = User) -> Response:
        enforce(request, user.user_id)
        svc.delete_account(user.user_id)
        pipeline.buffer.clear(user.user_id)
        return Response(status_code=204)

    @app.post("/v1/analytics/events", status_code=202)
    def analytics(body: M.AnalyticsEvent, request: Request, user: AuthUser = User) -> Response:
        enforce(request, user.user_id)
        prof = svc.ensure_user(user.user_id)
        essential = body.name in ("purchase", "trial_start", "trial_converted")
        if essential or prof["consents"].get("analytics"):
            store.insert("analytics_events", {"user_id": user.user_id, "name": body.name, "language": body.language, "props": body.props,
                                              "tier": svc.tier(user.user_id), "ts": datetime.now(UTC).isoformat()})
        return Response(status_code=202)

    @app.post("/v1/webhooks/revenuecat")
    async def revenuecat(request: Request) -> dict[str, Any]:
        enforce(request, request.client.host if request.client else "unknown", "webhook")
        secret = settings.revenuecat_webhook_secret
        got = request.headers.get("authorization", "")
        if not secret or not (safe_compare(got, secret) or safe_compare(got, f"Bearer {secret}")):
            raise HTTPException(401, "invalid signature")
        payload = await request.json()
        e = payload.get("event") or {}
        return _apply_revenuecat(svc, e)

    @app.post("/v1/dev/membership")
    def dev_membership(body: M.DevMembership, request: Request, user: AuthUser = User) -> dict[str, Any]:
        if not settings.is_dev:
            raise HTTPException(404, "not found")
        svc.set_membership(user.user_id, body.tier, "active", trial=False, source="dev-sandbox")
        return svc.state(user.user_id, "es")

    @app.get("/v1/audio/{path:path}")
    def audio(path: str) -> FileResponse:
        p = tts_cache.resolve(path)
        if not p:
            raise HTTPException(404, "not found")
        return FileResponse(p, media_type="audio/mpeg" if p.suffix == ".mp3" else "audio/wav", headers={"Cache-Control": "public, max-age=31536000, immutable"})

    @app.get("/v1/internal/latency")
    def latency_stats(request: Request, user: AuthUser = User) -> dict[str, Any]:
        if not settings.is_dev:
            raise HTTPException(404, "not found")
        return latency.snapshot()

    def _lang(code: str) -> str:
        if not lib.language(code):
            raise HTTPException(404, "unknown language")
        return code

    return app


def _apply_revenuecat(svc: Service, e: dict[str, Any]) -> dict[str, Any]:
    typ = e.get("type", "")
    uid = str(e.get("app_user_id") or "").lower()
    if typ == "TEST":
        return {"ok": True, "ignored": "test"}
    try:
        uuid.UUID(uid)
    except ValueError:
        return {"ok": True, "ignored": "anonymous user"}
    exp_ms = e.get("expiration_at_ms")
    exp = datetime.fromtimestamp(exp_ms / 1000, UTC).isoformat() if exp_ms else None
    trial = e.get("period_type") == "TRIAL"
    if typ in ("INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "NON_RENEWING_PURCHASE"):
        svc.set_membership(uid, "pro", "trialing" if trial else "active", trial=trial, expires_at=exp)
    elif typ == "BILLING_ISSUE":
        svc.set_membership(uid, "pro", "grace", trial=False, expires_at=exp)
    elif typ == "EXPIRATION":
        svc.set_membership(uid, "free", "expired", trial=False, expires_at=exp)
    elif typ == "CANCELLATION":
        pass  # Zugang bleibt bis zum Ablauf, Status aendert EXPIRATION
    else:
        return {"ok": True, "ignored": typ}
    return {"ok": True}
