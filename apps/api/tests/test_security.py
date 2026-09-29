"""Sicherheitsrelevante Regressionstests (siehe docs/SECURITY_AUDIT.md)."""
import asyncio
import json
import logging

import httpx
import pytest
from conftest import ROOT, b64, new_user, wav_bytes
from fastapi.testclient import TestClient

from learni_api.app import create_app
from learni_api.providers.base import ProviderError
from learni_api.providers.stt import GroqSTT

SECRET = "gsk_TOPSECRETVALUE1234567890abcdef"


def test_provider_errors_and_logs_never_contain_keys(caplog):
    caplog.set_level(logging.DEBUG)
    stt = GroqSTT(SECRET, client=httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(500, text="boom " + r.headers["authorization"]))))
    with pytest.raises(ProviderError) as e:
        asyncio.run(stt.transcribe(wav_bytes(), language_hint="es"))
    assert SECRET not in str(e.value) and SECRET not in caplog.text


def test_pipeline_survives_provider_failure_without_leaking(settings, store, caplog):
    from learni_api.config import RemoteConfig
    from learni_api.providers.factory import build_providers

    class BoomSTT:
        name, is_mock = "boom", False

        async def transcribe(self, audio, *, language_hint, mime="audio/wav"):
            raise ProviderError("HTTP 500")

    prov = build_providers(settings, RemoteConfig(settings))
    prov.stt = BoomSTT()
    app = create_app(settings, store, prov)
    c = TestClient(app)
    uid, h = new_user()
    c.patch("/v1/profile", json={"consents": {"voice_processing": True}}, headers=h)
    r = c.post("/v1/voice/turn", json={"language": "es", "audio_b64": b64(wav_bytes()), "audio_seconds": 1}, headers=h)
    assert r.status_code == 200 and r.json()["transcript"] == ""  # sauberer Fallback, kein 500


def test_health_and_config_expose_no_secrets(settings, store):
    settings.groq_api_key, settings.supabase_service_role_key, settings.supabase_jwt_secret = SECRET, "svc-role-XYZ", "jwt-secret-XYZ"
    settings.revenuecat_webhook_secret = "rc-secret-XYZ"
    c = TestClient(create_app(settings, store))
    blob = c.get("/health").text + c.get("/v1/config").text + c.get("/v1/languages").text
    for s in (SECRET, "svc-role-XYZ", "jwt-secret-XYZ", "rc-secret-XYZ"):
        assert s not in blob


def test_unhandled_error_returns_generic_500(settings, store):
    app = create_app(settings, store)

    @app.get("/boom")
    def boom():
        raise RuntimeError("db password is hunter2")

    c = TestClient(app, raise_server_exceptions=False)
    r = c.get("/boom")
    assert r.status_code == 500 and "hunter2" not in r.text


def test_all_v1_routes_require_auth_except_public(client):
    public = {("GET", "/v1/config"), ("GET", "/v1/languages"), ("POST", "/v1/webhooks/revenuecat"), ("GET", "/v1/audio/{path:path}")}
    for r in client.app.routes:
        if not getattr(r, "path", "").startswith("/v1"):
            continue
        for m in r.methods - {"HEAD", "OPTIONS"}:
            if (m, r.path) in public:
                continue
            path = r.path.replace("{exercise_id}", "x").replace("{path:path}", "x")
            resp = client.request(m, path, json={} if m in ("POST", "PATCH") else None)
            assert resp.status_code == 401, f"{m} {r.path} -> {resp.status_code}"


def test_user_isolation_across_state_and_export(client):
    (a_id, a), (_, b) = new_user(), new_user()
    client.patch("/v1/profile", json={"display_name": "Alice"}, headers=a)
    client.patch("/v1/profile", json={"display_name": "Bob"}, headers=b)
    client.post("/v1/exercises/next", json={"language": "es"}, headers=a)
    exp_b = json.dumps(client.get("/v1/export", headers=b).json())
    assert a_id not in exp_b and "Alice" not in exp_b
    assert client.get("/v1/profile", headers=b).json()["display_name"] == "Bob"


def test_validation_rejects_oversized_and_injection_shaped_input(client, user):
    _, h = user
    assert client.post("/v1/exercises/next", json={"language": "es'; drop table profiles;--"}, headers=h).status_code == 422
    assert client.post("/v1/voice/turn", json={"language": "es", "text": "x", "scenario_id": "../../etc/passwd"}, headers=h).status_code == 422
    assert client.post("/v1/exercises/x/answer", json={"language": "es", "answer": "a" * 5000}, headers=h).status_code == 422
    assert client.post("/v1/lessons/complete", json={"language": "es", "xp": 10**9, "mistakes": 0, "minutes": 1}, headers=h).status_code == 422


def test_xp_cannot_be_farmed_via_lesson_complete(client, user):
    _, h = user
    for _ in range(3):
        client.post("/v1/lessons/complete", json={"language": "es", "xp": 500, "mistakes": 0, "minutes": 1}, headers=h)
    xp = client.get("/v1/state", params={"language": "es"}, headers=h).json()["learning"]["xp"]
    assert xp == 45  # Server vergibt festen Bonus, der Client-Wert ist irrelevant


def test_repo_has_no_service_role_or_secret_in_mobile_sources():
    import re
    pat = re.compile(r"(SERVICE_ROLE|GROQ_API_KEY|AZURE_SPEECH_KEY|LLM_API_KEY|WEBHOOK_SECRET|JWT_SECRET|ELEVENLABS_API_KEY)")
    for f in (ROOT / "apps" / "mobile" / "src").rglob("*.ts*"):
        assert not pat.search(f.read_text(encoding="utf-8")), f
    for f in (ROOT / "apps" / "mobile").glob("app.config.ts"):
        assert not pat.search(f.read_text(encoding="utf-8")), f


def test_email_verification_flag_off_by_default_and_enforced_when_on(settings, store):
    import time
    import uuid

    import jwt

    settings.supabase_jwt_secret = "s" * 40
    uid = str(uuid.uuid4())

    def token(verified):
        return jwt.encode({"sub": uid, "aud": "authenticated", "exp": int(time.time()) + 60, "email": "a@b.de", "app_metadata": {"provider": "email"},
                           "user_metadata": {"email_verified": verified}}, settings.supabase_jwt_secret, algorithm="HS256")

    off = TestClient(create_app(settings, store))
    assert off.get("/v1/profile", headers={"Authorization": f"Bearer {token(False)}"}).status_code == 200  # frei testbar
    settings.flag_overrides = {"require_email_verification": True}
    on = TestClient(create_app(settings, store))
    assert on.get("/v1/profile", headers={"Authorization": f"Bearer {token(False)}"}).status_code == 403
    assert on.get("/v1/profile", headers={"Authorization": f"Bearer {token(True)}"}).status_code == 200
