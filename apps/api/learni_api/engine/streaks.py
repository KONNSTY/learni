"""Streak inkl. Freeze. Tage in UTC-Kalendertagen [ANNAHME: spaeter Nutzer-Zeitzone]."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass
class StreakState:
    days: int = 0
    last_active: date | None = None
    freezes: int = 0


def at_risk(s: StreakState, today: date) -> bool:
    """Streak laeuft heute ab, wenn gestern zuletzt aktiv und heute noch nichts getan."""
    return s.days > 0 and s.last_active == today - timedelta(days=1)


def effective_days(s: StreakState, today: date) -> int:
    if s.last_active is None:
        return 0
    gap = (today - s.last_active).days
    if gap <= 1:
        return s.days
    return s.days if gap - 1 <= s.freezes else 0


def record_activity(s: StreakState, today: date) -> tuple[StreakState, bool]:
    """Gibt (neuer Zustand, freeze_used) zurueck."""
    if s.last_active == today:
        return s, False
    if s.last_active is None:
        return StreakState(1, today, s.freezes), False
    gap = (today - s.last_active).days
    if gap == 1:
        return StreakState(s.days + 1, today, s.freezes), False
    missed = gap - 1
    if missed <= s.freezes:
        return StreakState(s.days + 1, today, s.freezes - missed), True
    return StreakState(1, today, s.freezes), False
