"""Herzen: nur entscheidbare Formate kosten Herzen. Sprechfehler NIE."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

DECIDABLE_TYPES = frozenset({"multiple_choice", "matching", "fill_blank", "listen_pick", "word_order"})


def is_decidable(exercise_type: str) -> bool:
    return exercise_type in DECIDABLE_TYPES


@dataclass
class Hearts:
    count: int
    max: int | None  # None = unbegrenzt (Pro)
    refill_at: datetime | None = None  # Zeitpunkt, ab dem das naechste Herz nachlaeuft

    @property
    def unlimited(self) -> bool:
        return self.max is None

    def to_row(self) -> dict[str, Any]:
        return {"hearts": self.count, "hearts_refill_at": self.refill_at.isoformat() if self.refill_at else None}


def load(row: dict[str, Any], max_hearts: int | None) -> Hearts:
    refill = row.get("hearts_refill_at")
    if isinstance(refill, str):
        refill = datetime.fromisoformat(refill)
    count = row.get("hearts")
    return Hearts(count=max_hearts if (count is None or max_hearts is None) else min(int(count), max_hearts), max=max_hearts, refill_at=refill)


def regenerate(h: Hearts, regen_minutes: int, now: datetime | None = None) -> Hearts:
    """1 Herz je `regen_minutes`, bis max."""
    now = now or datetime.now(UTC)
    if h.unlimited or h.count >= (h.max or 0):
        return Hearts(h.count, h.max, None)
    if h.refill_at is None:
        return Hearts(h.count, h.max, now + timedelta(minutes=regen_minutes))
    count, refill = h.count, h.refill_at
    step = timedelta(minutes=regen_minutes)
    while refill <= now and count < h.max:
        count += 1
        refill += step
    return Hearts(count, h.max, None if count >= h.max else refill)


def lose(h: Hearts, exercise_type: str, regen_minutes: int, now: datetime | None = None) -> tuple[Hearts, int]:
    """Herzverlust bei falscher Antwort. Gibt (neuer Zustand, verlorene Herzen) zurueck."""
    now = now or datetime.now(UTC)
    if h.unlimited or not is_decidable(exercise_type) or h.count <= 0:
        return h, 0
    new_count = h.count - 1
    refill = h.refill_at or (now + timedelta(minutes=regen_minutes))
    return Hearts(new_count, h.max, refill), 1


def add(h: Hearts, n: int = 1) -> Hearts:
    if h.unlimited:
        return h
    return Hearts(min(h.count + n, h.max or 0), h.max, h.refill_at if h.count + n < (h.max or 0) else None)
