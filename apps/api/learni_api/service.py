"""Domaenenlogik: Nutzerstand, Orchestrierung, Antworten, Herzen, Streaks, Loeschung, Export."""
from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from .config import RemoteConfig
from .content import ContentLibrary
from .engine import curriculum
from .engine import exercises as X
from .engine import gamification as G
from .engine import hearts as H
from .engine import streaks as S
from .engine.budget import BudgetService
from .engine.fsrs import Card, rating_from_answer, review
from .engine.orchestrator import NoContentError, Orchestrator
from .events import ev
from .paywall import for_budget, for_hearts
from .store import USER_TABLES, Store

DEFAULT_SETTINGS = {"avatar_voice": True, "sfx": True, "haptics": True, "show_translation": True, "auto_vad": False}
DEFAULT_CONSENTS = {"voice_processing": False, "personalized_ads": False, "analytics": False}
SKILLS = ("listening", "speaking", "vocabulary", "grammar")


class DomainError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


def _now() -> datetime:
    return datetime.now(UTC)


def effective_tier(m: dict[str, Any], now: datetime) -> str:
    if m.get("tier") != "pro":
        return "free"
    exp = m.get("expires_at")
    if exp:
        exp_dt = datetime.fromisoformat(exp) if isinstance(exp, str) else exp
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=UTC)
        if exp_dt < now:
            return "free"
    return "pro" if m.get("status") in ("active", "trialing", "trial", "grace") else "free"


class Service:
    def __init__(self, store: Store, cfg: RemoteConfig, lib: ContentLibrary, orch: Orchestrator | None = None):
        self.store, self.cfg, self.lib = store, cfg, lib
        self.orch = orch or Orchestrator(lib)
        self.budget = BudgetService(store, cfg)

    # -- Nutzer ------------------------------------------------------------------
    def ensure_user(self, user_id: str, *, native_language: str | None = None, ui_language: str | None = None, display_name: str | None = None) -> dict[str, Any]:
        prof = self.store.get("profiles", user_id=user_id)
        if not prof:
            prof = self.store.upsert("profiles", {
                "user_id": user_id, "display_name": display_name, "native_language": native_language or "de",
                "ui_language": ui_language or "de", "age_bracket": None, "avatar": {"id": "placeholder", "outfit": {}},
                "settings": dict(DEFAULT_SETTINGS), "consents": dict(DEFAULT_CONSENTS), "created_at": _now().isoformat()})
        if not self.store.get("memberships", user_id=user_id):
            self.store.upsert("memberships", {"user_id": user_id, "tier": "free", "status": "active", "trial": False,
                                              "expires_at": None, "source": "none", "regional_tier": "tier1"})
        return prof

    def regional_tier(self, country: str | None) -> str:
        """Geo-Tiering fuer Kostenlimits (Config `geo_tiers`)."""
        g = self.cfg.get("geo_tiers", default={}) or {}
        c = (country or "").upper()
        for tier in ("tier1", "tier3"):
            if c in g.get(tier, []):
                return tier
        return g.get("default", "tier1") if c else "tier1"

    def set_region(self, user_id: str, country: str | None) -> None:
        m = self.membership(user_id)
        if country and m.get("source") in (None, "none", "dev-sandbox", "mock") and m.get("regional_tier_locked") is not True:
            m.update(user_id=user_id, regional_tier=self.regional_tier(country))
            self.store.upsert("memberships", m)

    def membership(self, user_id: str) -> dict[str, Any]:
        m = self.store.get("memberships", user_id=user_id) or {"tier": "free", "status": "active", "regional_tier": "tier1"}
        return m

    def tier(self, user_id: str, now: datetime | None = None) -> str:
        return effective_tier(self.membership(user_id), now or _now())

    def profile_public(self, prof: dict[str, Any]) -> dict[str, Any]:
        keys = ("user_id", "display_name", "native_language", "ui_language", "age_bracket", "avatar", "settings", "consents")
        return {k: prof.get(k) for k in keys}

    def patch_profile(self, user_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        prof = self.ensure_user(user_id)
        for k in ("display_name", "native_language", "ui_language", "age_bracket"):
            if k in patch:
                prof[k] = patch[k]
        for k, defaults in (("settings", DEFAULT_SETTINGS), ("consents", DEFAULT_CONSENTS)):
            if k in patch:
                prof[k] = {**defaults, **prof.get(k, {}), **patch[k]}
        if prof.get("age_bracket") == "under_16":
            prof["consents"] = {**prof["consents"], "personalized_ads": False}
        return self.profile_public(self.store.upsert("profiles", prof))

    # -- Lernstand ---------------------------------------------------------------
    def learner(self, user_id: str, language: str, now: datetime | None = None) -> dict[str, Any]:
        if not self.lib.language(language):
            raise DomainError(404, "unknown language")
        row = self.store.get("learner_state", user_id=user_id, language=language)
        if not row:
            mx = self.cfg.tier(self.tier(user_id))["max_hearts"]
            row = {"user_id": user_id, "language": language, "level": "A1", "goal": "fun", "daily_goal_minutes": 10, "daily_xp": 0,
                   "daily_xp_day": (now or _now()).date().isoformat(), "xp": 0, "streak_days": 0, "streak_last_active": None,
                   "streak_freezes": int(self.cfg.tier(self.tier(user_id))["streak_freezes"]), "hearts": mx if mx is not None else 5,
                   "hearts_refill_at": None, "trophies": [], "skills": {s: 0.0 for s in SKILLS}, "lessons": 0, "seq": 0,
                   "accuracy": 1.0, "recent_items": [], "mistakes": {}}
        today = (now or _now()).date().isoformat()
        if row.get("daily_xp_day") != today:
            row["daily_xp"], row["daily_xp_day"] = 0, today
        return row

    def _hearts(self, user_id: str, row: dict[str, Any], now: datetime) -> H.Hearts:
        mx = self.cfg.tier(self.tier(user_id, now))["max_hearts"]
        return H.regenerate(H.load(row, mx), int(self.cfg.get("free", "heart_regen_minutes", default=240)), now)

    def state(self, user_id: str, language: str, now: datetime | None = None) -> dict[str, Any]:
        now = now or _now()
        prof = self.ensure_user(user_id)
        row = self.learner(user_id, language, now)
        h = self._hearts(user_id, row, now)
        tier = self.tier(user_id, now)
        m = self.membership(user_id)
        streak = S.StreakState(int(row["streak_days"]), date.fromisoformat(row["streak_last_active"]) if row.get("streak_last_active") else None, int(row["streak_freezes"]))
        per_min = int(self.cfg.get("xp", "daily_target_per_minute", default=10))
        b = self.budget.status(user_id, tier, m.get("regional_tier", "tier1"), now)
        return {
            "profile": self.profile_public(prof),
            "membership": {"tier": tier, "status": m.get("status", "active"), "trial": bool(m.get("trial")), "expires_at": m.get("expires_at"),
                           "source": m.get("source", "none"), "regional_tier": m.get("regional_tier", "tier1")},
            "learning": {"language": language, "level": row["level"], "goal": row["goal"], "daily_goal_minutes": row["daily_goal_minutes"],
                         "daily_xp": row["daily_xp"], "daily_xp_target": G.daily_target(row["daily_goal_minutes"], per_min), "xp": row["xp"],
                         "streak_days": S.effective_days(streak, now.date()), "streak_freezes": row["streak_freezes"], "hearts": h.count,
                         "max_hearts": h.max, "unlimited_hearts": h.unlimited, "trophies": row["trophies"], "skills": row["skills"]},
            "budget": b.public(),
        }

    def onboarding(self, user_id: str, req: dict[str, Any]) -> dict[str, Any]:
        self.ensure_user(user_id)
        lang = req["language"]
        row = self.learner(user_id, lang)
        level = curriculum.placement_level(req["self_level"], req.get("adaptive_answers") or [])
        row.update(level=level, goal=req["goal"], daily_goal_minutes=req["daily_goal_minutes"])
        self.store.upsert("learner_state", row)
        return curriculum.plan(self.lib, lang, level, req["goal"], req["daily_goal_minutes"])

    def plan(self, user_id: str, language: str) -> dict[str, Any]:
        row = self.learner(user_id, language)
        return curriculum.plan(self.lib, language, row["level"], row["goal"], row["daily_goal_minutes"])

    # -- Uebungen ----------------------------------------------------------------
    def _cards(self, user_id: str, language: str) -> dict[str, Card]:
        return {r["item_id"]: Card.from_row(r) for r in self.store.select("item_states", user_id=user_id, language=language)}

    def next_exercise(self, user_id: str, language: str, now: datetime | None = None) -> dict[str, Any]:
        now = now or _now()
        prof = self.ensure_user(user_id)
        row = self.learner(user_id, language, now)
        tier = self.tier(user_id, now)
        h = self._hearts(user_id, row, now)
        events: list[dict[str, Any]] = []
        hearts_blocked = not h.unlimited and h.count <= 0
        try:
            ex = self.orch.build(user_id=user_id, language=language, level=row["level"], skills=row["skills"], cards=self._cards(user_id, language),
                                 recent=row["recent_items"], now=now, seq=int(row["seq"]), ui_lang=prof["ui_language"], accuracy=float(row["accuracy"]),
                                 decidable_allowed=not hearts_blocked)
        except NoContentError as e:
            raise DomainError(404, "no content available for this language/level yet") from e
        if ex["type"] == "roleplay" and not self.cfg.tier(tier)["roleplay"]:
            events.append(ev("paywall.requested", {"trigger": "pro_feature"}, now))
        if hearts_blocked:
            events.append(ev("hearts.empty", {"paywall_trigger": "hearts_empty"}, now))
        row["seq"] = int(row["seq"]) + 1
        row["recent_items"] = ([ex["item_id"], *row["recent_items"]])[:6]
        self.store.upsert("learner_state", row)
        self._issue(user_id, ex)
        return {"exercise": X.public_view(ex), "events": events, "test_mode": ex.get("pack_status") == "draft"}

    def _issue(self, user_id: str, ex: dict[str, Any]) -> None:
        self.store.upsert("issued_exercises", {"user_id": user_id, "exercise_id": ex["id"], "language": ex["language"], "type": ex["type"],
                                               "item_id": ex["item_id"], "skill": ex["skill"], "decidable": ex["decidable"],
                                               "expected_answer": ex.get("expected_answer"), "created_at": _now().isoformat()})

    def issue_tutor_exercise(self, user_id: str, language: str, level: str, turn: dict[str, Any], ex_id: str) -> dict[str, Any]:
        """Aus einem validierten LLM-Turn eine (nur ausgelieferte) Uebung machen; Herzen nur fuer entscheidbare Typen."""
        ex_type = turn["exercise_type"]
        ex = X.base_exercise(ex_id, ex_type, language, "llm.turn", "speaking" if ex_type == "speak_repeat" else "vocabulary", level,
                             H.is_decidable(ex_type), turn["say"], "draft")
        ex["source"] = "llm"
        ex["content"] = {"options": turn.get("options", [])} if ex_type == "multiple_choice" else {"target_text": turn.get("expected_answer") or ""}
        ex["prompt"]["hint"] = turn.get("hint")
        ex["expected_answer"] = turn.get("expected_answer")
        self._issue(user_id, ex)
        return X.public_view(ex)

    def answer(self, user_id: str, exercise_id: str, language: str, given: Any, response_ms: int | None = None,
               pronunciation_score: float | None = None, now: datetime | None = None) -> list[dict[str, Any]]:
        now = now or _now()
        issued = self.store.get("issued_exercises", user_id=user_id, exercise_id=exercise_id)
        if not issued or issued["language"] != language:
            raise DomainError(404, "exercise not found")
        row = self.learner(user_id, language, now)
        ex_type = issued["type"]
        if ex_type in ("speak_repeat", "roleplay") and pronunciation_score is not None:
            correct = pronunciation_score >= 60
        else:
            correct = X.evaluate(ex_type, issued.get("expected_answer"), given)
        h = self._hearts(user_id, row, now)
        regen = int(self.cfg.get("free", "heart_regen_minutes", default=240))
        events: list[dict[str, Any]] = []
        lost = 0
        if not correct:
            h, lost = H.lose(h, ex_type, regen, now)
        events.append(ev("answer.evaluated", {"exercise_id": exercise_id, "correct": correct, "decidable": bool(issued["decidable"]), "hearts_lost": lost,
                                              "feedback_key": ("feedback.correct" if correct else ("feedback.retry_speaking" if not issued["decidable"] else "feedback.wrong")),
                                              "correct_answer": None if correct else issued.get("expected_answer"),
                                              "pronunciation_score": pronunciation_score}, now))
        if lost or row.get("hearts") != h.count:
            events.append(ev("hearts.changed", {"hearts": h.count, "max_hearts": h.max, "unlimited": h.unlimited}, now))
        trig = for_hearts(h.count, h.unlimited)
        if lost and trig:
            events += [ev("hearts.empty", {"paywall_trigger": "hearts_empty"}, now), ev("paywall.requested", {"trigger": trig}, now)]
        row.update(h.to_row())
        # FSRS + Lernermodell (nur Curriculum-Items)
        if issued["item_id"] != "llm.turn":
            card = Card.from_row(self.store.get("item_states", user_id=user_id, language=language, item_id=issued["item_id"]))
            flash = {"again": 1, "hard": 2, "good": 3, "easy": 4}.get(str(given).lower()) if ex_type == "flashcard" else None
            new = review(card, flash or rating_from_answer(correct, response_ms), now)
            self.store.upsert("item_states", {"user_id": user_id, "language": language, "item_id": issued["item_id"], **new.to_row()})
            if not correct:
                row["mistakes"][issued["item_id"]] = int(row["mistakes"].get(issued["item_id"], 0)) + 1
        row["skills"] = G.update_mastery(row["skills"], issued["skill"], correct)
        row["accuracy"] = round(0.9 * float(row["accuracy"]) + 0.1 * (1.0 if correct else 0.0), 4)
        if correct and issued["decidable"] or (correct and ex_type in ("speak_repeat", "flashcard")):
            per_min = int(self.cfg.get("xp", "daily_target_per_minute", default=10))
            r = G.add_xp(int(row["xp"]), int(row["daily_xp"]), G.daily_target(row["daily_goal_minutes"], per_min), int(self.cfg.get("xp", "per_correct", default=10)))
            row["xp"], row["daily_xp"] = r.xp, r.daily_xp
            events += [ev(t, p, now) for t, p in r.events]
        reviewed = len([c for c in self._cards(user_id, language).values() if c.reps > 0])
        up = G.maybe_level_up(row["level"], row["skills"], reviewed, float(self.cfg.get("levels", "up_mastery_threshold", default=0.8)), int(self.cfg.get("levels", "min_reviewed_items", default=12)))
        if up:
            row["level"] = up
            events.append(ev("level.up", {"language": language, "level": up}, now))
        self.store.upsert("learner_state", row)
        self.store.delete("issued_exercises", user_id=user_id, exercise_id=exercise_id)  # einmalig einloesbar
        self._update_tutor_profile(user_id, language, issued, correct, response_ms, now)
        return events

    def _update_tutor_profile(self, user_id: str, language: str, issued: dict[str, Any], correct: bool, response_ms: int | None, now: datetime) -> None:
        """KI-Profil nur aus Lernverhalten (keine Emotionserkennung)."""
        tp = self.store.get("tutor_profiles", user_id=user_id, language=language) or {
            "user_id": user_id, "language": language, "goals": [], "interests": [], "typical_mistakes": [], "pace": "normal", "preferences": {}}
        row = self.store.get("learner_state", user_id=user_id, language=language) or {}
        if row.get("goal") and row["goal"] not in tp["goals"]:
            tp["goals"] = [row["goal"]]
        if not correct and issued["item_id"] != "llm.turn":
            found = self.lib.find_item(language, issued["item_id"])
            if found:
                lemma = found[1]["lemma"]
                tp["typical_mistakes"] = ([lemma, *[m for m in tp["typical_mistakes"] if m != lemma]])[:10]
        if response_ms is not None:
            tp["pace"] = "slow" if response_ms > 9000 else ("fast" if response_ms < 2500 else "normal")
        tp["updated_at"] = now.isoformat()
        self.store.upsert("tutor_profiles", tp)

    def complete_lesson(self, user_id: str, language: str, mistakes: int, minutes: float, now: datetime | None = None) -> list[dict[str, Any]]:
        now = now or _now()
        row = self.learner(user_id, language, now)
        events: list[dict[str, Any]] = []
        st = S.StreakState(int(row["streak_days"]), date.fromisoformat(row["streak_last_active"]) if row.get("streak_last_active") else None, int(row["streak_freezes"]))
        st, freeze_used = S.record_activity(st, now.date())
        tier_cfg = self.cfg.tier(self.tier(user_id, now))
        st.freezes = max(st.freezes, int(tier_cfg["streak_freezes"])) if tier_cfg["streak_freezes"] else st.freezes
        row.update(streak_days=st.days, streak_last_active=st.last_active.isoformat(), streak_freezes=st.freezes)
        bonus = int(self.cfg.get("xp", "lesson_bonus", default=15))
        per_min = int(self.cfg.get("xp", "daily_target_per_minute", default=10))
        r = G.add_xp(int(row["xp"]), int(row["daily_xp"]), G.daily_target(row["daily_goal_minutes"], per_min), bonus)
        row.update(xp=r.xp, daily_xp=r.daily_xp, lessons=int(row["lessons"]) + 1)
        events += [ev(t, p, now) for t, p in r.events]
        events.append(ev("streak.updated", {"days": st.days, "freeze_used": freeze_used, "at_risk": False}, now))
        for t in G.new_trophies({"lessons": row["lessons"], "streak_days": st.days, "xp": row["xp"]}, row["trophies"]):
            row["trophies"] = [*row["trophies"], t]
            events.append(ev("reward.granted", {"kind": "trophy", "amount": 1, "trophy_id": t}, now))
        events.append(ev("lesson.completed", {"xp_gained": bonus, "mistakes": mistakes, "minutes": minutes}, now))
        self.store.upsert("learner_state", row)
        return events

    def rewarded_ad(self, user_id: str, language: str, now: datetime | None = None) -> list[dict[str, Any]]:
        now = now or _now()
        tier = self.tier(user_id, now)
        if tier == "pro":
            raise DomainError(409, "not applicable for pro")
        day = now.date().isoformat()
        usage = self.store.get("usage_daily", user_id=user_id, day=day) or {"user_id": user_id, "day": day, "ai_seconds": 0, "cost_cents": 0.0}
        if int(usage.get("rewarded_ads", 0)) >= 3:
            raise DomainError(429, "daily rewarded ad limit reached")
        row = self.learner(user_id, language, now)
        h = H.add(self._hearts(user_id, row, now), 1)
        row.update(h.to_row())
        usage["rewarded_ads"] = int(usage.get("rewarded_ads", 0)) + 1
        self.store.upsert("usage_daily", usage)
        self.store.upsert("learner_state", row)
        return [ev("reward.granted", {"kind": "heart", "amount": 1, "reason": "rewarded_ad"}, now), ev("hearts.changed", {"hearts": h.count, "max_hearts": h.max, "unlimited": h.unlimited}, now)]

    def budget_events(self, user_id: str, now: datetime | None = None) -> list[dict[str, Any]]:
        now = now or _now()
        tier = self.tier(user_id, now)
        b = self.budget.status(user_id, tier, self.membership(user_id).get("regional_tier", "tier1"), now)
        if not b.limited:
            return []
        reason = "ai_minutes" if b.reason in ("ai_minutes", "global_kill_switch") else b.reason
        reason = reason if reason in ("ai_minutes", "cost_cents", "fair_use") else "cost_cents"
        trig = for_budget(b.reason) if tier == "free" else None
        out = [ev("budget.limited", {"reason": reason, "fallback": "cached_content", "paywall_trigger": trig}, now)]
        if trig:
            out.append(ev("paywall.requested", {"trigger": trig}, now))
        return out

    # -- Mitgliedschaft ------------------------------------------------------------
    def set_membership(self, user_id: str, tier: str, status: str = "active", *, trial: bool = False, expires_at: str | None = None, source: str = "revenuecat") -> dict[str, Any]:
        self.ensure_user(user_id)
        m = self.membership(user_id)
        m.update(user_id=user_id, tier=tier, status=status, trial=trial, expires_at=expires_at, source=source)
        self.store.upsert("memberships", m)
        return ev("membership.changed", {"tier": tier, "status": status})

    # -- Datenschutz -----------------------------------------------------------------
    def tutor_profile(self, user_id: str, language: str) -> dict[str, Any]:
        return self.store.get("tutor_profiles", user_id=user_id, language=language) or {"user_id": user_id, "language": language, "goals": [], "interests": [], "typical_mistakes": [], "pace": "normal", "preferences": {}}

    def delete_tutor_profile(self, user_id: str, language: str) -> None:
        self.store.delete("tutor_profiles", user_id=user_id, language=language)

    def export(self, user_id: str) -> dict[str, Any]:
        return {t: self.store.select(t, user_id=user_id) for t in USER_TABLES if t != "issued_exercises"}

    def delete_account(self, user_id: str) -> dict[str, int]:
        counts = {t: self.store.delete(t, user_id=user_id) for t in USER_TABLES}
        self.store.delete_auth_user(user_id)
        return counts
