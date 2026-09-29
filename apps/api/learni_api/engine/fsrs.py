"""FSRS-4.5 (Free Spaced Repetition Scheduler), reine Funktionen.

Formeln: Retrievability R(t,S) = (1 + F*t/S)^D mit D=-0.5, F=19/81.
Standardgewichte sind die veroeffentlichten FSRS-4.5-Defaults [UNVERIFIZIERT gegen aktuelle
Release-Version; per `Params(w=...)` austauschbar, sobald personalisierte Gewichte vorliegen].
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

AGAIN, HARD, GOOD, EASY = 1, 2, 3, 4
DECAY = -0.5
FACTOR = 19 / 81

DEFAULT_W = (
    0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
    0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
)


@dataclass(frozen=True)
class Params:
    w: tuple[float, ...] = DEFAULT_W
    request_retention: float = 0.9
    maximum_interval: int = 365


@dataclass
class Card:
    stability: float = 0.0
    difficulty: float = 0.0
    reps: int = 0
    lapses: int = 0
    last_review: datetime | None = None
    due: datetime | None = None

    def to_row(self) -> dict[str, Any]:
        d = asdict(self)
        d["last_review"] = self.last_review.isoformat() if self.last_review else None
        d["due"] = self.due.isoformat() if self.due else None
        return d

    @classmethod
    def from_row(cls, row: dict[str, Any] | None) -> Card:
        if not row:
            return cls()
        parse = lambda v: datetime.fromisoformat(v) if isinstance(v, str) else v  # noqa: E731
        return cls(
            stability=float(row.get("stability") or 0.0),
            difficulty=float(row.get("difficulty") or 0.0),
            reps=int(row.get("reps") or 0),
            lapses=int(row.get("lapses") or 0),
            last_review=parse(row.get("last_review")),
            due=parse(row.get("due")),
        )

    @property
    def is_new(self) -> bool:
        return self.reps == 0


def _clamp_d(d: float) -> float:
    return min(max(d, 1.0), 10.0)


def retrievability(card: Card, now: datetime) -> float:
    if card.is_new or card.last_review is None or card.stability <= 0:
        return 0.0
    elapsed_days = max((now - card.last_review).total_seconds() / 86400, 0.0)
    return (1 + FACTOR * elapsed_days / card.stability) ** DECAY


def next_interval_days(stability: float, p: Params) -> int:
    ivl = stability / FACTOR * (p.request_retention ** (1 / DECAY) - 1)
    return int(min(max(round(ivl), 1), p.maximum_interval))


def _init_stability(g: int, w: tuple[float, ...]) -> float:
    return max(w[g - 1], 0.1)


def _init_difficulty(g: int, w: tuple[float, ...]) -> float:
    return _clamp_d(w[4] - math.exp(w[5] * (g - 1)) + 1)


def _next_difficulty(d: float, g: int, w: tuple[float, ...]) -> float:
    d0_easy = _init_difficulty(EASY, w)
    nd = d - w[6] * (g - 3)
    return _clamp_d(w[7] * d0_easy + (1 - w[7]) * nd)


def _recall_stability(d: float, s: float, r: float, g: int, w: tuple[float, ...]) -> float:
    hard = w[15] if g == HARD else 1.0
    easy = w[16] if g == EASY else 1.0
    return s * (1 + math.exp(w[8]) * (11 - d) * s ** -w[9] * (math.exp(w[10] * (1 - r)) - 1) * hard * easy)


def _forget_stability(d: float, s: float, r: float, w: tuple[float, ...]) -> float:
    return w[11] * d ** -w[12] * ((s + 1) ** w[13] - 1) * math.exp(w[14] * (1 - r))


def review(card: Card, rating: int, now: datetime | None = None, params: Params | None = None) -> Card:
    """Gibt eine neue Karte zurueck (pure). rating: 1 Again, 2 Hard, 3 Good, 4 Easy."""
    if rating not in (1, 2, 3, 4):
        raise ValueError("rating must be 1..4")
    p = params or Params()
    now = now or datetime.now(UTC)
    w = p.w
    new = Card(reps=card.reps + 1, lapses=card.lapses, last_review=now)
    if card.is_new:
        new.stability = _init_stability(rating, w)
        new.difficulty = _init_difficulty(rating, w)
    else:
        r = retrievability(card, now)
        new.difficulty = _next_difficulty(card.difficulty, rating, w)
        if rating == AGAIN:
            new.lapses += 1
            new.stability = min(_forget_stability(card.difficulty, card.stability, r, w), card.stability)
        else:
            new.stability = _recall_stability(card.difficulty, card.stability, r, rating, w)
    new.stability = max(new.stability, 0.1)
    if rating == AGAIN:
        new.due = now + timedelta(minutes=10)
    else:
        new.due = now + timedelta(days=next_interval_days(new.stability, p))
    return new


def rating_from_answer(correct: bool, response_ms: int | None, hinted: bool = False) -> int:
    """Deterministische Abbildung Antwort -> FSRS-Rating."""
    if not correct:
        return AGAIN
    if hinted:
        return HARD
    if response_ms is not None and response_ms < 2500:
        return EASY
    if response_ms is not None and response_ms > 9000:
        return HARD
    return GOOD
