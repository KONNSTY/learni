"""Semantische Events (Contract: packages/contracts/schemas/events.schema.json)."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

EVENT_VERSION = "1.0.0"


def ev(type_: str, payload: dict[str, Any], now: datetime | None = None) -> dict[str, Any]:
    ts = (now or datetime.now(UTC)).isoformat()
    return {"event_version": EVENT_VERSION, "type": type_, "ts": ts, "payload": payload}
