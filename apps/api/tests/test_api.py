import jsonschema
from conftest import load_schema, new_user, validate_events


def _answer_for(client, h, ex, correct=True):
    """Antwort ermitteln: Backend kennt die Loesung, der Test liest sie aus dem Store."""
    store = client.app.state.store
    uid = h["Authorization"].split("dev:")[1]
    issued = store.get("issued_exercises", user_id=uid, exercise_id=ex["id"])
    exp = issued["expected_answer"]
    if correct:
        return exp if exp is not None else "good"
    return "WRONG" if not isinstance(exp, list) else list(reversed(exp)) + ["x"]


def test_health_lists_mock_providers(client):
    j = client.get("/health").json()
    assert j["status"] == "ok" and set(j["mock_providers"]) == {"llm", "stt", "tts", "pronunciation"}


def test_config_public_has_no_cost_limits(client):
    j = client.get("/v1/config").json()
    assert "cost_cents_per_day" not in str(j) and j["pricing"]["trial_days"] == 7


def test_languages_use_badges_not_flags(client):
    langs = client.get("/v1/languages").json()
    assert len(langs) == 6 and all(len(x["badge"]) == 2 and x["badge"].isascii() for x in langs)


def test_auth_required_and_invalid(client):
    assert client.get("/v1/profile").status_code == 401
    assert client.get("/v1/profile", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    assert client.get("/v1/profile", headers={"Authorization": "Bearer dev:not-a-uuid"}).status_code == 401


def test_dev_token_rejected_in_prod(settings, store):
    from fastapi.testclient import TestClient

    from learni_api.app import create_app
    settings.app_env = "prod"
    c = TestClient(create_app(settings, store))
    uid, h = new_user()
    assert c.get("/v1/profile", headers=h).status_code == 401
    assert c.post("/v1/dev/membership", json={"tier": "pro"}, headers=h).status_code == 401
    assert c.get("/docs").status_code == 404


def test_jwt_validation(settings, store):
    import time
    import uuid

    import jwt
    from fastapi.testclient import TestClient

    from learni_api.app import create_app
    settings.supabase_jwt_secret = "s" * 40
    c = TestClient(create_app(settings, store))
    uid = str(uuid.uuid4())
    good = jwt.encode({"sub": uid, "aud": "authenticated", "exp": int(time.time()) + 60}, settings.supabase_jwt_secret, algorithm="HS256")
    assert c.get("/v1/profile", headers={"Authorization": f"Bearer {good}"}).status_code == 200
    expired = jwt.encode({"sub": uid, "aud": "authenticated", "exp": int(time.time()) - 5}, settings.supabase_jwt_secret, algorithm="HS256")
    wrong_aud = jwt.encode({"sub": uid, "aud": "x", "exp": int(time.time()) + 60}, settings.supabase_jwt_secret, algorithm="HS256")
    forged = jwt.encode({"sub": uid, "aud": "authenticated", "exp": int(time.time()) + 60}, "other" * 10, algorithm="HS256")
    none_alg = jwt.encode({"sub": uid, "aud": "authenticated", "exp": int(time.time()) + 60}, "", algorithm="none")
    for bad in (expired, wrong_aud, forged, none_alg):
        assert c.get("/v1/profile", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_full_flow_register_onboard_lesson_delete(client, user):
    uid, h = user
    s = client.post("/v1/auth/sync", json={"ui_language": "de", "display_name": "Mia"}, headers=h).json()
    assert s["membership"]["tier"] == "free" and s["learning"]["hearts"] == 5
    plan = client.post("/v1/onboarding", json={"language": "es", "self_level": "none", "goal": "travel", "daily_goal_minutes": 10,
                                                "adaptive_answers": [{"item_id": "es.hello", "correct": True}, {"item_id": "es.yes", "correct": True}]}, headers=h).json()
    assert plan["level"] == "A1" and plan["paywall_trigger"] == "onboarding_plan" and plan["topics"][0] == "basics"
    for _ in range(6):
        r = client.post("/v1/exercises/next", json={"language": "es"}, headers=h)
        assert r.status_code == 200, r.text
        body = r.json()
        jsonschema.validate(body["exercise"], load_schema("exercise.schema.json"))
        assert "expected_answer" not in body["exercise"]
        assert body["test_mode"] is True  # Draft-Content -> Testmodus/Beta
        a = client.post(f"/v1/exercises/{body['exercise']['id']}/answer", json={"language": "es", "answer": _answer_for(client, h, body["exercise"]), "response_ms": 3000}, headers=h)
        assert a.status_code == 200, a.text
        validate_events(a.json()["events"])
    done = client.post("/v1/lessons/complete", json={"language": "es", "xp": 60, "mistakes": 0, "minutes": 5}, headers=h).json()
    validate_events(done["events"])
    types = [e["type"] for e in done["events"]]
    assert "streak.updated" in types and "lesson.completed" in types
    st = client.get("/v1/state", params={"language": "es"}, headers=h).json()
    assert st["learning"]["streak_days"] == 1 and st["learning"]["xp"] > 0
    exp = client.get("/v1/export", headers=h).json()
    assert exp["profiles"][0]["user_id"] == uid and exp["item_states"]
    assert client.delete("/v1/account", headers=h).status_code == 204
    store = client.app.state.store
    for t, rows in store.tables.items():
        assert not [r for r in rows if r.get("user_id") == uid], f"{t} not purged"
    assert uid in store.auth_users_deleted


def test_answer_single_use_and_idor(client):
    a_uid, a = new_user()
    b_uid, b = new_user()
    ex = client.post("/v1/exercises/next", json={"language": "es"}, headers=a).json()["exercise"]
    ans = {"language": "es", "answer": "x"}
    assert client.post(f"/v1/exercises/{ex['id']}/answer", json=ans, headers=b).status_code == 404  # IDOR
    assert client.post(f"/v1/exercises/{ex['id']}/answer", json=ans, headers=a).status_code == 200
    assert client.post(f"/v1/exercises/{ex['id']}/answer", json=ans, headers=a).status_code == 404  # Replay


def test_wrong_decidable_costs_heart_until_empty_then_speaking_continues(client, user):
    uid, h = user
    client.post("/v1/auth/sync", json={}, headers=h)
    lost, seen_paywall = 0, False
    for _ in range(40):
        ex = client.post("/v1/exercises/next", json={"language": "es"}, headers=h).json()["exercise"]
        ev = client.post(f"/v1/exercises/{ex['id']}/answer", json={"language": "es", "answer": "WRONG"}, headers=h).json()["events"]
        validate_events(ev)
        ae = next(e for e in ev if e["type"] == "answer.evaluated")["payload"]
        if not ex["decidable"]:
            assert ae["hearts_lost"] == 0
        lost += ae["hearts_lost"]
        seen_paywall |= any(e["type"] == "paywall.requested" and e["payload"]["trigger"] == "hearts_empty" for e in ev)
    st = client.get("/v1/state", params={"language": "es"}, headers=h).json()
    assert lost == 5 and st["learning"]["hearts"] == 0 and seen_paywall
    nxt = client.post("/v1/exercises/next", json={"language": "es"}, headers=h).json()
    assert nxt["exercise"]["decidable"] is False  # ohne Herzen: nur Sprechen/Karten
    assert any(e["type"] == "hearts.empty" for e in nxt["events"])


def test_pro_has_unlimited_hearts(client, user):
    _, h = user
    client.post("/v1/dev/membership", json={"tier": "pro"}, headers=h)
    for _ in range(12):
        ex = client.post("/v1/exercises/next", json={"language": "es"}, headers=h).json()["exercise"]
        client.post(f"/v1/exercises/{ex['id']}/answer", json={"language": "es", "answer": "WRONG"}, headers=h)
    st = client.get("/v1/state", params={"language": "es"}, headers=h).json()
    assert st["learning"]["unlimited_hearts"] and st["membership"]["tier"] == "pro"


def test_rewarded_ad_gives_heart_free_only_with_cap(client, user):
    _, h = user
    client.post("/v1/auth/sync", json={}, headers=h)
    for _ in range(6):
        ex = client.post("/v1/exercises/next", json={"language": "es"}, headers=h).json()["exercise"]
        client.post(f"/v1/exercises/{ex['id']}/answer", json={"language": "es", "answer": "WRONG"}, headers=h)
    codes = [client.post("/v1/ads/rewarded", params={"language": "es"}, headers=h).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


def test_profile_patch_rules(client, user):
    _, h = user
    r = client.patch("/v1/profile", json={"settings": {"haptics": False}, "consents": {"personalized_ads": True}, "age_bracket": "under_16"}, headers=h).json()
    assert r["settings"]["haptics"] is False and r["settings"]["sfx"] is True
    assert r["consents"]["personalized_ads"] is False  # Minderjaehrige: nie personalisierte Werbung
    assert client.patch("/v1/profile", json={"tier": "pro"}, headers=h).status_code == 422  # kein Mass-Assignment
    assert client.patch("/v1/profile", json={"ui_language": "xx"}, headers=h).status_code == 422


def test_unknown_language_404(client, user):
    _, h = user
    assert client.get("/v1/state", params={"language": "zz"}, headers=h).status_code == 404
    assert client.post("/v1/exercises/next", json={"language": "zz"}, headers=h).status_code == 404


def test_tutor_profile_view_and_delete(client, user):
    uid, h = user
    client.post("/v1/auth/sync", json={}, headers=h)
    ex = client.post("/v1/exercises/next", json={"language": "es"}, headers=h).json()["exercise"]
    client.post(f"/v1/exercises/{ex['id']}/answer", json={"language": "es", "answer": "WRONG", "response_ms": 12000}, headers=h)
    tp = client.get("/v1/tutor-profile", params={"language": "es"}, headers=h).json()
    assert tp["pace"] == "slow" and tp["typical_mistakes"]
    assert client.delete("/v1/tutor-profile", params={"language": "es"}, headers=h).status_code == 204
    assert client.get("/v1/tutor-profile", params={"language": "es"}, headers=h).json()["typical_mistakes"] == []


def test_revenuecat_webhook(settings, store):
    from fastapi.testclient import TestClient

    from learni_api.app import create_app
    settings.revenuecat_webhook_secret = "whsec_test_123"
    c = TestClient(create_app(settings, store))
    uid, h = new_user()
    c.post("/v1/auth/sync", json={}, headers=h)
    body = {"event": {"type": "INITIAL_PURCHASE", "app_user_id": uid, "period_type": "TRIAL", "expiration_at_ms": 4102444800000}}
    assert c.post("/v1/webhooks/revenuecat", json=body).status_code == 401
    assert c.post("/v1/webhooks/revenuecat", json=body, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert c.post("/v1/webhooks/revenuecat", json=body, headers={"Authorization": "Bearer whsec_test_123"}).status_code == 200
    m = c.get("/v1/state", params={"language": "es"}, headers=h).json()["membership"]
    assert m["tier"] == "pro" and m["trial"] is True
    exp = {"event": {"type": "EXPIRATION", "app_user_id": uid}}
    c.post("/v1/webhooks/revenuecat", json=exp, headers={"Authorization": "whsec_test_123"})
    assert c.get("/v1/state", params={"language": "es"}, headers=h).json()["membership"]["tier"] == "free"


def test_revenuecat_disabled_without_secret(client):
    assert client.post("/v1/webhooks/revenuecat", json={"event": {"type": "TEST"}}, headers={"Authorization": ""}).status_code == 401


def test_expired_pro_downgrades(client, user, store):
    uid, h = user
    client.post("/v1/auth/sync", json={}, headers=h)
    m = store.get("memberships", user_id=uid)
    m.update(tier="pro", status="active", expires_at="2020-01-01T00:00:00+00:00")
    store.upsert("memberships", m)
    assert client.get("/v1/state", params={"language": "es"}, headers=h).json()["membership"]["tier"] == "free"


def test_analytics_consent(client, user, store):
    uid, h = user
    client.post("/v1/analytics/events", json={"name": "app_open"}, headers=h)
    assert store.select("analytics_events", user_id=uid) == []
    client.post("/v1/analytics/events", json={"name": "trial_start"}, headers=h)  # essenziell
    client.patch("/v1/profile", json={"consents": {"analytics": True}}, headers=h)
    client.post("/v1/analytics/events", json={"name": "app_open", "props": {"x": 1}}, headers=h)
    assert [e["name"] for e in store.select("analytics_events", user_id=uid)] == ["trial_start", "app_open"]
    assert client.post("/v1/analytics/events", json={"name": "hack"}, headers=h).status_code == 422


def test_rate_limit_exercise(client, user, monkeypatch):
    from learni_api import security
    monkeypatch.setattr(security, "LIMITS", {"exercise": (2.0, 30), "default": (5.0, 60), "voice": (0.2, 12), "webhook": (5.0, 30)})
    _, h = user
    codes = [client.post("/v1/exercises/next", json={"language": "es"}, headers=h).status_code for _ in range(45)]
    assert 429 in codes and codes[0] == 200


def test_security_headers_and_cors(client):
    r = client.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert "access-control-allow-origin" not in client.get("/health", headers={"Origin": "https://evil.example"}).headers


def test_payload_too_large(client, user):
    _, h = user
    r = client.post("/v1/voice/turn", content=b"x" * (7 * 1024 * 1024), headers={**h, "Content-Type": "application/json"})
    assert r.status_code == 413
