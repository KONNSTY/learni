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


def test_flashcard_self_rating_drives_fsrs_and_never_costs_hearts(client, user, store):
    uid, h = user
    ex = client.post("/v1/exercises/next", json={"language": "es"}, headers=h).json()["exercise"]
    assert ex["type"] == "flashcard"
    ev = client.post(f"/v1/exercises/{ex['id']}/answer", json={"language": "es", "answer": "again"}, headers=h).json()["events"]
    assert ev[0]["payload"]["correct"] is False and ev[0]["payload"]["hearts_lost"] == 0
    card = store.get("item_states", user_id=uid, language="es", item_id=ex["item_id"])
    assert card["lapses"] == 0 and card["reps"] == 1  # neue Karte + "again": Stabilitaet klein, kein Lapse
    ex2 = client.post("/v1/exercises/next", json={"language": "es"}, headers=h).json()["exercise"]
    client.post(f"/v1/exercises/{ex2['id']}/answer", json={"language": "es", "answer": "easy"}, headers=h)
    good = store.get("item_states", user_id=uid, language="es", item_id=ex2["item_id"])
    assert good["stability"] > card["stability"]


def test_exercise_gets_prerendered_audio_url_when_cached(client, user):
    import asyncio
    _, h = user
    ex = client.post("/v1/exercises/next", json={"language": "es"}, headers=h).json()["exercise"]
    assert ex["type"] == "flashcard" and ex["prompt"]["audio_url"] is None
    cache = client.app.state.pipeline.tts_cache
    asyncio.run(cache.get(ex["content"]["target_text"], "es", 1.0))  # wie scripts/prerender_audio
    fresh = new_user()[1]
    ex2 = client.post("/v1/exercises/next", json={"language": "es"}, headers=fresh).json()["exercise"]
    assert ex2["content"]["target_text"] == ex["content"]["target_text"] and ex2["prompt"]["audio_url"].endswith(".wav")


def test_revenuecat_webhook_records_kpi_events(settings, store):
    from fastapi.testclient import TestClient

    from learni_api.app import create_app
    settings.revenuecat_webhook_secret = "whsec_kpi"
    c = TestClient(create_app(settings, store))
    uid, h = new_user()
    c.post("/v1/auth/sync", json={}, headers=h)
    hd = {"Authorization": "Bearer whsec_kpi"}
    c.post("/v1/webhooks/revenuecat", json={"event": {"type": "INITIAL_PURCHASE", "app_user_id": uid, "period_type": "TRIAL", "product_id": "pro_yearly"}}, headers=hd)
    c.post("/v1/webhooks/revenuecat", json={"event": {"type": "RENEWAL", "app_user_id": uid, "is_trial_conversion": True}}, headers=hd)
    c.post("/v1/webhooks/revenuecat", json={"event": {"type": "RENEWAL", "app_user_id": uid}}, headers=hd)
    assert [e["name"] for e in store.select("analytics_events", user_id=uid)] == ["trial_start", "trial_converted"]


def test_geo_tiering_from_device_region_and_store_country(settings, store):
    from fastapi.testclient import TestClient

    from learni_api.app import create_app
    settings.revenuecat_webhook_secret = "whsec_geo"
    c = TestClient(create_app(settings, store))
    uid, h = new_user()
    assert c.post("/v1/auth/sync", json={"region": "IN"}, headers=h).json()["membership"]["regional_tier"] == "tier3"
    uid2, h2 = new_user()
    assert c.post("/v1/auth/sync", json={"region": "BR"}, headers=h2).json()["membership"]["regional_tier"] == "tier2"
    assert c.post("/v1/auth/sync", json={"region": "de"}, headers=h2).status_code == 422
    # Store-Land aus dem Webhook gewinnt und ist danach gesperrt
    c.post("/v1/webhooks/revenuecat", json={"event": {"type": "INITIAL_PURCHASE", "app_user_id": uid2, "country_code": "DE"}}, headers={"Authorization": "Bearer whsec_geo"})
    c.post("/v1/auth/sync", json={"region": "IN"}, headers=h2)
    assert c.get("/v1/state", params={"language": "es"}, headers=h2).json()["membership"]["regional_tier"] == "tier1"
    # niedrigeres Tier => kleineres Cent-Budget
    svc = c.app.state.svc
    assert svc.budget.status(uid, "free", "tier3").cost_cents_limit < svc.budget.status(uid2, "free", "tier1").cost_cents_limit


def test_explain_uses_cache_and_never_stores_mock(client, user, store):
    _, h = user
    r = client.post("/v1/explain", json={"language": "es", "item_id": "es.hello"}, headers=h).json()
    assert r["test_mode"] is True and r["text"] and r["cached"] is False
    assert store.select("explanations") == []  # Mock-Antworten werden nie als Lerninhalt gespeichert
    store.upsert("explanations", {"language": "es", "ui_language": "de", "item_id": "es.hello", "text": "Begruessung.", "model": "x"})
    r2 = client.post("/v1/explain", json={"language": "es", "item_id": "es.hello"}, headers=h).json()
    assert r2 == {"text": "Begruessung.", "cached": True, "test_mode": False}
    assert client.post("/v1/explain", json={"language": "es", "item_id": "es.nope"}, headers=h).status_code == 404
    assert client.post("/v1/explain", json={"language": "es", "item_id": "../x"}, headers=h).status_code == 422


def test_explain_respects_budget(client, user):
    uid, h = user
    client.post("/v1/auth/sync", json={}, headers=h)
    client.app.state.svc.budget.charge(uid, 1, 99)
    r = client.post("/v1/explain", json={"language": "es", "item_id": "es.hello"}, headers=h).json()
    assert r["text"] == "" and r["events"][0]["type"] == "budget.limited"


def test_streak_at_risk_trigger_only_late_and_only_for_free_with_long_streak(client, user, store):
    from datetime import UTC, datetime, timedelta
    uid, h = user
    client.post("/v1/auth/sync", json={}, headers=h)
    svc = client.app.state.svc
    now = datetime(2026, 9, 29, 19, 0, tzinfo=UTC)
    row = svc.learner(uid, "es", now)
    row.update(streak_days=5, streak_last_active=(now - timedelta(days=1)).date().isoformat(), daily_xp_day=now.date().isoformat(), daily_xp=0)
    store.upsert("learner_state", row)
    def risk(t):
        return ("paywall.requested", "streak_at_risk") in [(e["type"], e["payload"].get("trigger")) for e in svc.next_exercise(uid, "es", t)["events"]]

    def update(**kw):
        r = svc.learner(uid, "es", now)
        r.update(kw)
        store.upsert("learner_state", r)

    assert risk(now)
    assert not risk(now.replace(hour=9))  # morgens noch nicht
    update(streak_days=2)
    assert not risk(now)  # Serie zu kurz
    update(streak_days=5, daily_xp=20)
    assert not risk(now)  # heute schon aktiv
    update(daily_xp=0)
    svc.set_membership(uid, "pro")
    assert not risk(now)  # Pro
