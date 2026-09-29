import json
from datetime import UTC, datetime, timedelta

import jsonschema
import pytest
import yaml
from conftest import ROOT, load_schema

from learni_api import n8n, security
from learni_api.config import RemoteConfig, Settings
from learni_api.content import ContentLibrary
from learni_api.engine import curriculum
from learni_api.engine import exercises as X
from learni_api.engine.budget import BudgetService
from learni_api.engine.fsrs import Card, review
from learni_api.engine.orchestrator import NoContentError, Orchestrator
from learni_api.store import MemoryStore

NOW = datetime(2026, 9, 29, 12, 0, tzinfo=UTC)


# ---- Content-Status-Gate -------------------------------------------------------------
def _lib(tmp_path, status, allow_draft):
    import shutil
    dst = tmp_path / "content"
    shutil.copytree(ROOT / "content", dst)
    for f in (dst / "packs" / "es").glob("*.json"):
        d = json.loads(f.read_text())
        d["status"] = status
        f.write_text(json.dumps(d))
    return ContentLibrary(dst, allow_draft)


@pytest.mark.parametrize("status,allow,served", [("draft", False, False), ("draft", True, True), ("reviewed", False, True), ("published", False, True)])
def test_content_status_gate(tmp_path, status, allow, served):
    assert bool(_lib(tmp_path, status, allow).packs("es")) is served


def test_prod_serves_no_draft_content_and_api_says_so(tmp_path, settings):
    from fastapi.testclient import TestClient

    from learni_api.app import create_app
    settings.app_env = "prod"
    c = TestClient(create_app(settings, MemoryStore()))
    # prod: kein Dev-Token -> hier direkt ueber Service pruefen
    svc = c.app.state.svc
    with pytest.raises(Exception) as e:
        svc.next_exercise("00000000-0000-0000-0000-000000000001", "es")
    assert "no content" in str(getattr(e.value, "detail", e.value))


def test_invalid_pack_status_rejected(tmp_path):
    import shutil
    dst = tmp_path / "c"
    shutil.copytree(ROOT / "content", dst)
    f = next((dst / "packs" / "es").glob("*.json"))
    d = json.loads(f.read_text())
    d["status"] = "live"
    f.write_text(json.dumps(d))
    with pytest.raises(ValueError):
        ContentLibrary(dst, True)


def test_all_packs_are_well_formed_and_unreviewed():
    lib = ContentLibrary(ROOT / "content", True)
    codes = {x["code"] for x in lib.languages}
    assert codes == {"en", "es", "fr", "hr", "id", "tr"}
    for code in codes:
        packs = lib.packs(code)
        assert packs and all(p.status == "draft" for p in packs)  # ohne Muttersprachler-Review nie hoeher
        for p in packs:
            for i in p.items:
                assert i["item_id"].startswith(code + ".") and i["translations"]["de"] and i["translations"]["en"]
    ids = [i["item_id"] for c in codes for p in lib.packs(c) for i in p.items]
    assert len(ids) == len(set(ids))


# ---- Orchestrator: deterministisch, ohne LLM ---------------------------------------------
def _build(orch, seq=0, cards=None, level="A1", skills=None, recent=None, **kw):
    return orch.build(user_id="u1", language="es", level=level, skills=skills or {}, cards=cards or {}, recent=recent or [], now=NOW, seq=seq, **kw)


def test_orchestrator_is_deterministic():
    orch = Orchestrator(ContentLibrary(ROOT / "content", True))
    a, b = _build(orch), _build(orch)
    assert a == b


def test_new_items_start_as_flashcards_and_due_items_first():
    orch = Orchestrator(ContentLibrary(ROOT / "content", True))
    first = _build(orch)
    assert first["type"] == "flashcard" and first["decidable"] is False
    old = review(Card(), 3, NOW - timedelta(days=30))
    due = _build(orch, cards={"es.thanks": old})
    assert due["item_id"] == "es.thanks" and due["type"] != "flashcard"


def test_every_exercise_type_validates_against_schema():
    orch = Orchestrator(ContentLibrary(ROOT / "content", True))
    lib = orch.lib
    schema = load_schema("exercise.schema.json")
    seen = set()
    cards = {i["item_id"]: review(review(Card(), 3, NOW - timedelta(days=40)), 3, NOW - timedelta(days=20)) for _, i in lib.items("es", "A1")}
    for seq in range(60):
        for skills in ({"listening": 0.9, "speaking": 0.9, "vocabulary": 0.0, "grammar": 0.9}, {"listening": 0.0, "speaking": 0.9, "vocabulary": 0.9, "grammar": 0.9},
                       {"listening": 0.9, "speaking": 0.0, "vocabulary": 0.9, "grammar": 0.9}, {"listening": 0.9, "speaking": 0.9, "vocabulary": 0.9, "grammar": 0.0}):
            ids = sorted(cards)
            ex = _build(orch, seq=seq, cards=cards if seq % 2 else {}, skills=skills, ui_lang="de", recent=[ids[seq % len(ids)], ids[(seq * 7) % len(ids)]])
            public = X.public_view(ex)
            jsonschema.validate(public, schema)
            seen.add(ex["type"])
            if ex["type"] in ("multiple_choice", "listen_pick", "fill_blank"):
                assert ex["expected_answer"] in ex["content"]["options"] and len(set(ex["content"]["options"])) == len(ex["content"]["options"])
            assert ex["decidable"] == (ex["type"] in ("multiple_choice", "matching", "fill_blank", "listen_pick", "word_order"))
    assert {"flashcard", "multiple_choice", "listen_pick", "speak_repeat", "fill_blank"} <= seen


def test_no_content_for_language_without_served_packs(tmp_path):
    lib = ContentLibrary(ROOT / "content", False)  # nur reviewed/published -> nichts
    with pytest.raises(NoContentError):
        Orchestrator(lib).build(user_id="u", language="es", level="A1", skills={}, cards={}, recent=[], now=NOW, seq=0)


def test_evaluate_rules():
    assert X.evaluate("multiple_choice", "Wasser", " wasser ")
    assert X.evaluate("fill_blank", "quiero", "Quiero")
    assert X.evaluate("fill_blank", "café", "cafe")  # Akzent-tolerant
    assert not X.evaluate("multiple_choice", "Wasser", "Milch")
    assert X.evaluate("word_order", ["Quiero", "un", "café"], ["quiero", "un", "café"])
    assert not X.evaluate("word_order", ["Quiero", "un", "café"], ["un", "quiero", "café"])
    assert X.evaluate("matching", ["a|1", "b|2"], ["b|2", "a|1"])
    assert not X.evaluate("matching", ["a|1", "b|2"], ["a|2", "b|1"]) and not X.evaluate("matching", ["a|1"], ["garbage"])
    assert X.evaluate("speak_repeat", "Buenos días", "buenos dias") and not X.evaluate("speak_repeat", "Buenos días amigo mio", "hola")


def test_placement_and_plan():
    assert curriculum.placement_level("none", []) == "A1"
    assert curriculum.placement_level("few_words", [{"correct": True}, {"correct": True}]) == "A2"
    assert curriculum.placement_level("simple_conversations", [{"correct": False}, {"correct": False}, {"correct": False}]) == "A1"
    lib = ContentLibrary(ROOT / "content", True)
    p = curriculum.plan(lib, "es", "A1", "travel", 10)
    assert p["topics"][:2] == ["basics", "food_drink"] and p["weeks_to_next_level"] >= 2
    g = curriculum.build_graph(lib, "es")
    assert {n.level for n in g} == {"A1", "A2"} and any("es.querer_present" in n.grammar for n in g)


# ---- Budget / Kill-Switch ---------------------------------------------------------------
def test_budget_limits_per_tier_and_geo():
    cfg = RemoteConfig(Settings())
    b = BudgetService(MemoryStore(), cfg)
    assert not b.status("u", "free").limited
    b.charge("u", 300, 10)
    assert not b.status("u", "free").limited
    b.charge("u", 301, 0)
    assert b.status("u", "free").reason == "ai_minutes"
    assert b.status("u", "pro").limited is False
    b2 = BudgetService(MemoryStore(), cfg)
    b2.charge("v", 10, 18)  # 25 * 0.7 = 17.5 Cent bei tier2
    assert b2.status("v", "free", "tier2").reason == "cost_cents" and not b2.status("v", "free", "tier1").limited


def test_global_kill_switch_stops_everyone():
    cfg = RemoteConfig(Settings())
    cfg.data["global_cost_kill_switch_cents_per_day"] = 50
    b = BudgetService(MemoryStore(), cfg)
    b.charge("a", 1, 30)
    b.charge("b", 1, 30)
    assert b.status("c", "pro").limited and b.status("c", "pro").reason == "global_kill_switch"


def test_budget_resets_next_day():
    b = BudgetService(MemoryStore(), RemoteConfig(Settings()))
    b.charge("u", 9999, 99, NOW)
    assert b.status("u", "free", now=NOW).limited and not b.status("u", "free", now=NOW + timedelta(days=1)).limited


def test_fair_use_reason_for_pro():
    b = BudgetService(MemoryStore(), RemoteConfig(Settings()))
    b.charge("u", 2700, 1)
    assert b.status("u", "pro").reason == "fair_use"


# ---- Security-Helfer ---------------------------------------------------------------------
@pytest.mark.parametrize("url", ["http://example.com", "https://127.0.0.1/x", "https://10.0.0.5", "https://169.254.169.254/latest", "https://[::1]/", "https://localhost/x", "ftp://x.com", "https://foo.internal/", "file:///etc/passwd"])
def test_ssrf_rejects(url):
    with pytest.raises(ValueError):
        security.assert_public_https_url(url, resolve=False)


def test_ssrf_allows_public_ip():
    assert security.assert_public_https_url("https://8.8.8.8/x", resolve=False)


def test_rate_limiter_token_bucket():
    t = [0.0]
    rl = security.RateLimiter(clock=lambda: t[0])
    assert [rl.allow("u", "b", 1.0, 3) for _ in range(4)] == [True, True, True, False]
    t[0] = 2.0
    assert rl.allow("u", "b", 1.0, 3) and rl.allow("u", "b", 1.0, 3) and not rl.allow("u", "b", 1.0, 3)
    assert rl.allow("other", "b", 1.0, 3)


def test_n8n_signed_request_and_noop_without_config():
    s = Settings(n8n_base_url="https://8.8.8.8", n8n_webhook_secret="topsecret")
    url, headers, body = n8n.build_request(s, "user.deleted", {"id": "x"}, now=1000)
    assert url.endswith("/webhook/learni-user-deleted") and headers["X-Learni-Timestamp"] == "1000"
    assert headers["X-Learni-Signature"] == security.sign("topsecret", "1000", body)
    assert "topsecret" not in body.decode() and "topsecret" not in json.dumps(headers)
    with pytest.raises(RuntimeError):
        n8n.build_request(Settings(), "x", {})
    import asyncio
    assert asyncio.run(n8n.notify(Settings(), "x", {})) is False
    with pytest.raises(ValueError):
        n8n.build_request(Settings(n8n_base_url="http://8.8.8.8", n8n_webhook_secret="s"), "x", {})


def test_feature_flags_default_off_and_env_override(monkeypatch):
    s = Settings.from_env()
    cfg = RemoteConfig(s)
    assert not any(cfg.flag(k) for k in ("bot_protection", "captcha", "require_email_verification", "login_rate_limits"))
    monkeypatch.setenv("FLAG_CAPTCHA", "true")
    assert RemoteConfig(Settings.from_env()).flag("captcha")


# ---- Contracts ---------------------------------------------------------------------------
def test_openapi_valid_and_matches_routes(app):
    spec = yaml.safe_load((ROOT / "packages/contracts/openapi.yaml").read_text())
    spec_ops = {(m.upper(), p) for p, item in spec["paths"].items() for m in item if m in ("get", "post", "patch", "delete")}
    app_ops = set()
    for r in app.routes:
        if r.path.startswith("/v1") or r.path == "/health":
            for m in r.methods - {"HEAD", "OPTIONS"}:
                app_ops.add((m, r.path))
    undocumented = {o for o in app_ops if o not in spec_ops and not o[1].startswith(("/v1/audio", "/v1/internal"))}
    assert undocumented == set(), f"routes missing in OpenAPI: {undocumented}"
    assert {o for o in spec_ops if o not in app_ops} == set()


def test_avatar_manifest_schema_and_placeholder():
    schema = load_schema("avatar-manifest.schema.json")
    sample = json.loads((ROOT / "packages/contracts/examples/avatar-manifest.placeholder.json").read_text())
    jsonschema.validate(sample, schema)
    bad = {**sample, "inputs": {**sample["inputs"], "viseme": {"name": "v", "min": 0, "max": 30}}}
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, schema)


def test_event_schema_rejects_ui_instructions():
    schema = load_schema("events.schema.json")
    bad = {"event_version": "1.0.0", "type": "answer.evaluated", "ts": "x", "payload": {"exercise_id": "1", "correct": True, "decidable": True, "hearts_lost": 0, "feedback_key": "k", "play_sound": "ding.mp3"}}
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, schema)
    assert not any(k in json.dumps(schema) for k in ("color", "haptic", "sound", "animation"))


def test_content_folder_has_no_secrets():
    import re
    pat = re.compile(r"(sk-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})")
    for f in (ROOT / "content").rglob("*"):
        if f.is_file():
            assert not pat.search(f.read_text(encoding="utf-8", errors="ignore")), f


def test_word_order_for_well_known_vocabulary_in_sentence():
    orch = Orchestrator(ContentLibrary(ROOT / "content", True))
    strong = review(review(Card(), 3, NOW - timedelta(days=40)), 3, NOW - timedelta(days=20))
    strong.due = NOW - timedelta(days=1)
    ex = _build(orch, cards={"es.coffee": strong}, skills={"listening": 1, "speaking": 1, "vocabulary": 0, "grammar": 1}, ui_lang="de")
    assert ex["type"] == "word_order" and sorted(ex["content"]["tokens"]) == sorted(ex["expected_answer"])
    assert ex["prompt"]["say"] == "Ich möchte einen Kaffee" and ex["decidable"]


def test_kpi_report_covers_required_kpis():
    from datetime import date

    from learni_api import kpi
    st = MemoryStore()
    today = date(2026, 9, 29)
    st.upsert("profiles", {"user_id": "u1", "created_at": "2026-09-22T10:00:00+00:00"})
    st.upsert("profiles", {"user_id": "u2", "created_at": "2026-09-22T11:00:00+00:00"})
    for uid, ts in (("u1", "2026-09-23T09:00:00+00:00"), ("u1", "2026-09-29T09:00:00+00:00"), ("u2", "2026-09-29T09:00:00+00:00")):
        st.insert("analytics_events", {"user_id": uid, "name": "app_open", "ts": ts, "language": "es", "props": {}})
    st.insert("analytics_events", {"user_id": "u1", "name": "trial_start", "ts": "2026-09-24T09:00:00+00:00", "props": {}})
    st.insert("analytics_events", {"user_id": "u1", "name": "trial_converted", "ts": "2026-10-01T09:00:00+00:00", "props": {}})
    st.insert("analytics_events", {"user_id": "u1", "name": "ad_impression", "ts": "2026-09-29T09:30:00+00:00", "props": {"revenue_cents": 0.5}})
    st.insert("analytics_events", {"user_id": "u1", "name": "voice_turn", "ts": "2026-09-29T09:30:00+00:00", "language": "es", "props": {}})
    st.insert("analytics_events", {"user_id": "u1", "name": "error", "ts": "2026-09-29T09:31:00+00:00", "language": "es", "props": {}})
    st.upsert("usage_daily", {"user_id": "u1", "day": "2026-09-29", "ai_seconds": 60, "cost_cents": 2.0})
    r = kpi.report(st, today, latency_p95_ms=1700)
    assert r["dau"] == 2 and r["retention"]["d1"] == 0.5 and r["retention"]["d7"] == 1.0 and r["retention"]["d30"] is None
    assert r["trial_to_paid"] == 1.0 and r["cogs_cents_per_dau"] == 1.0 and r["ad_arpdau_cents"] == 0.25
    assert r["latency_p95_ms"] == 1700 and r["error_rate_per_language"] == {"es": 0.5}


def test_redis_rate_limiter_fixed_window_and_fallback():
    class FakeRedis:
        def __init__(self):
            self.d, self.ttl = {}, {}

        def incr(self, k):
            self.d[k] = self.d.get(k, 0) + 1
            return self.d[k]

        def expire(self, k, s):
            self.ttl[k] = s

    r = FakeRedis()
    rl = security.RedisRateLimiter(r)
    assert [rl.allow("u", "b", 1.0, 3) for _ in range(5)] == [True, True, True, False, False]
    assert rl.allow("other", "b", 1.0, 3) and list(r.ttl.values())[0] == 3

    class Broken:
        def incr(self, k):
            raise ConnectionError("down")

    rl2 = security.RedisRateLimiter(Broken())
    assert [rl2.allow("u", "b", 1.0, 2) for _ in range(3)] == [True, True, False]  # lokaler Fallback greift


def test_new_items_are_introduced_in_blocks_then_practiced_in_the_same_session():
    orch = Orchestrator(ContentLibrary(ROOT / "content", True))
    cards, recent, types, now = {}, [], [], NOW
    for seq in range(8):
        ex = orch.build(user_id="u", language="es", level="A1", skills={}, cards=cards, recent=recent, now=now, seq=seq)
        types.append(ex["type"])
        card = cards.get(ex["item_id"], Card())
        cards[ex["item_id"]] = review(card, 3, now)
        recent = [ex["item_id"], *recent][:6]
        now += timedelta(seconds=30)
    assert types[:2] == ["flashcard", "flashcard"]  # Einfuehrung in 2er-Block
    assert types[2] != "flashcard"                   # danach Uebung des zuerst gesehenen Items, nicht noch mehr Neues
    assert types.count("flashcard") <= 5 and any(t != "flashcard" for t in types[2:])  # Neues und Uebung wechseln sich ab
