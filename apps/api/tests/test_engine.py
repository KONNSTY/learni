from datetime import UTC, date, datetime, timedelta

import pytest

from learni_api.engine import fsrs, hearts, streaks
from learni_api.engine import gamification as G

T0 = datetime(2026, 9, 29, 12, 0, tzinfo=UTC)


def test_fsrs_first_review_sets_state_and_due():
    c = fsrs.review(fsrs.Card(), fsrs.GOOD, T0)
    assert c.reps == 1 and c.stability == pytest.approx(fsrs.DEFAULT_W[2])
    assert 1 <= c.difficulty <= 10
    assert c.due > T0


def test_fsrs_again_shortens_and_counts_lapse():
    good = fsrs.review(fsrs.Card(), fsrs.GOOD, T0)
    later = T0 + timedelta(days=int(good.stability))
    again = fsrs.review(good, fsrs.AGAIN, later)
    assert again.lapses == 1 and again.stability < good.stability
    assert again.due - later <= timedelta(minutes=10)


def test_fsrs_stability_grows_on_success_and_easy_beats_hard():
    c = fsrs.review(fsrs.Card(), fsrs.GOOD, T0)
    t = T0 + timedelta(days=3)
    hard, good, easy = (fsrs.review(c, r, t).stability for r in (fsrs.HARD, fsrs.GOOD, fsrs.EASY))
    assert c.stability < hard < good < easy


def test_fsrs_retrievability_decays_and_is_one_at_zero():
    c = fsrs.review(fsrs.Card(), fsrs.GOOD, T0)
    assert fsrs.retrievability(c, T0) == pytest.approx(1.0)
    assert fsrs.retrievability(c, T0 + timedelta(days=30)) < fsrs.retrievability(c, T0 + timedelta(days=1))


def test_fsrs_interval_matches_target_retention():
    p = fsrs.Params()
    s = 10.0
    ivl = fsrs.next_interval_days(s, p)
    r = (1 + fsrs.FACTOR * ivl / s) ** fsrs.DECAY
    assert r == pytest.approx(p.request_retention, abs=0.02)


def test_fsrs_rejects_bad_rating_and_roundtrip():
    with pytest.raises(ValueError):
        fsrs.review(fsrs.Card(), 5, T0)
    c = fsrs.review(fsrs.Card(), fsrs.GOOD, T0)
    assert fsrs.Card.from_row(c.to_row()) == c


def test_rating_mapping():
    assert fsrs.rating_from_answer(False, 1000) == fsrs.AGAIN
    assert fsrs.rating_from_answer(True, 1000) == fsrs.EASY
    assert fsrs.rating_from_answer(True, 5000) == fsrs.GOOD
    assert fsrs.rating_from_answer(True, 12000) == fsrs.HARD
    assert fsrs.rating_from_answer(True, 1000, hinted=True) == fsrs.HARD


def test_hearts_decidable_costs_speaking_never():
    h = hearts.Hearts(5, 5)
    h2, lost = hearts.lose(h, "multiple_choice", 240, T0)
    assert lost == 1 and h2.count == 4
    for t in ("speak_repeat", "roleplay", "flashcard"):
        h3, lost = hearts.lose(h, t, 240, T0)
        assert lost == 0 and h3.count == 5


def test_hearts_pro_unlimited_and_floor_zero():
    assert hearts.lose(hearts.Hearts(0, None), "fill_blank", 240, T0)[1] == 0
    assert hearts.lose(hearts.Hearts(0, 5), "fill_blank", 240, T0)[1] == 0


def test_hearts_regenerate_over_time():
    h, _ = hearts.lose(hearts.Hearts(5, 5), "matching", 240, T0)
    h, _ = hearts.lose(h, "matching", 240, T0)
    assert h.count == 3
    r = hearts.regenerate(h, 240, T0 + timedelta(hours=4, minutes=1))
    assert r.count == 4
    r = hearts.regenerate(h, 240, T0 + timedelta(hours=9))
    assert r.count == 5 and r.refill_at is None


def test_hearts_add_caps_at_max():
    assert hearts.add(hearts.Hearts(4, 5), 3).count == 5


def test_streak_progression_and_freeze():
    d = date(2026, 9, 29)
    s, used = streaks.record_activity(streaks.StreakState(), d)
    assert (s.days, used) == (1, False)
    s, _ = streaks.record_activity(s, d + timedelta(days=1))
    assert s.days == 2
    same, _ = streaks.record_activity(s, d + timedelta(days=1))
    assert same.days == 2
    s.freezes = 1
    s2, used = streaks.record_activity(s, d + timedelta(days=3))  # 1 Tag verpasst
    assert used and s2.days == 3 and s2.freezes == 0
    s3, used = streaks.record_activity(s2, d + timedelta(days=10))
    assert s3.days == 1 and not used


def test_streak_risk_and_effective_days():
    d = date(2026, 9, 29)
    s = streaks.StreakState(5, d - timedelta(days=1), 0)
    assert streaks.at_risk(s, d)
    assert streaks.effective_days(s, d) == 5
    assert streaks.effective_days(s, d + timedelta(days=2)) == 0


def test_xp_daily_goal_event_once():
    r = G.add_xp(0, 90, 100, 10)
    assert r.goal_reached_now and any(t == "daily_goal.reached" for t, _ in r.events)
    assert not G.add_xp(0, 100, 100, 10).goal_reached_now


def test_mastery_and_level_up():
    s = {"listening": 0, "speaking": 0, "vocabulary": 0, "grammar": 0}
    for _ in range(40):
        s = G.update_mastery(s, "vocabulary", True)
    assert s["vocabulary"] > 0.99
    full = {k: 0.9 for k in s}
    assert G.maybe_level_up("A1", full, 20, 0.8, 12) == "A2"
    assert G.maybe_level_up("A1", full, 5, 0.8, 12) is None
    assert G.maybe_level_up("B2", full, 99, 0.8, 12) is None


def test_trophies():
    assert "first_lesson" in G.new_trophies({"lessons": 1, "streak_days": 1, "xp": 0}, [])
    assert "first_lesson" not in G.new_trophies({"lessons": 2, "streak_days": 1, "xp": 0}, ["first_lesson"])
