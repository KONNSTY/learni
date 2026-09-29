"""Gamification-Logik (nur Logik, alles als semantische Events). Ligen/Freunde als Datenmodell."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..content import LEVELS

TROPHIES = {
    "first_lesson": lambda s: s["lessons"] >= 1,
    "streak_7": lambda s: s["streak_days"] >= 7,
    "streak_30": lambda s: s["streak_days"] >= 30,
    "xp_1000": lambda s: s["xp"] >= 1000,
}
LEAGUES = ["bronze", "silver", "gold", "sapphire", "diamond"]


@dataclass
class LeagueEntry:
    """Datenmodell (keine Logik im MVP): woechentliche Liga."""
    user_id: str
    league: str = "bronze"
    week: str = ""
    weekly_xp: int = 0


@dataclass
class Friendship:
    user_id: str
    friend_id: str
    status: str = "pending"  # pending | accepted


@dataclass
class XpResult:
    xp: int
    daily_xp: int
    gained: int
    goal_reached_now: bool
    events: list[tuple[str, dict[str, Any]]] = field(default_factory=list)


def daily_target(daily_minutes: int, per_minute: int) -> int:
    return daily_minutes * per_minute


def add_xp(xp: int, daily_xp: int, target: int, amount: int) -> XpResult:
    before_reached = daily_xp >= target
    new_daily = daily_xp + amount
    reached_now = not before_reached and new_daily >= target
    ev: list[tuple[str, dict[str, Any]]] = [("reward.granted", {"kind": "xp", "amount": amount, "reason": "practice"})]
    if reached_now:
        ev.append(("daily_goal.reached", {"xp": new_daily}))
    return XpResult(xp + amount, new_daily, amount, reached_now, ev)


def update_mastery(skills: dict[str, float], skill: str, correct: bool, alpha: float = 0.15) -> dict[str, float]:
    out = dict(skills)
    cur = out.get(skill, 0.0)
    out[skill] = round(cur + alpha * ((1.0 if correct else 0.0) - cur), 4)
    return out


def maybe_level_up(level: str, skills: dict[str, float], reviewed_items: int, threshold: float, min_items: int) -> str | None:
    """Naechstes Level, wenn Mittelwert der vier Skills >= threshold und genug Items wiederholt."""
    idx = LEVELS.index(level)
    if idx >= len(LEVELS) - 1 or reviewed_items < min_items:
        return None
    vals = [skills.get(s, 0.0) for s in ("listening", "speaking", "vocabulary", "grammar")]
    return LEVELS[idx + 1] if sum(vals) / 4 >= threshold else None


def new_trophies(stats: dict[str, Any], owned: list[str]) -> list[str]:
    return [t for t, cond in TROPHIES.items() if t not in owned and cond(stats)]
