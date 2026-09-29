"""KI-Minuten- und Cent-Budget pro Nutzer und Tag mit Kill-Switch."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from ..config import RemoteConfig
from ..store import Store


@dataclass
class BudgetStatus:
    ai_seconds_used: int
    ai_seconds_limit: int
    cost_cents_used: float
    cost_cents_limit: float
    limited: bool
    reason: str | None = None  # ai_minutes | cost_cents | fair_use | global_kill_switch

    def public(self) -> dict[str, Any]:
        return {
            "ai_seconds_used": self.ai_seconds_used,
            "ai_seconds_limit": self.ai_seconds_limit,
            "cost_cents_used": round(self.cost_cents_used, 3),
            "cost_cents_limit": round(self.cost_cents_limit, 3),
            "limited": self.limited,
        }


def today_key(now: datetime | None = None) -> str:
    return (now or datetime.now(UTC)).date().isoformat()


class BudgetService:
    def __init__(self, store: Store, cfg: RemoteConfig):
        self.store = store
        self.cfg = cfg

    def _limits(self, tier: str, regional_tier: str) -> tuple[int, float]:
        t = self.cfg.tier(tier)
        mult = self.cfg.get("geo_cost_multiplier", regional_tier, default=1.0)
        return int(t["ai_seconds_per_day"]), float(t["cost_cents_per_day"]) * float(mult)

    def status(self, user_id: str, tier: str, regional_tier: str = "tier1", now: datetime | None = None) -> BudgetStatus:
        day = today_key(now)
        row = self.store.get("usage_daily", user_id=user_id, day=day) or {}
        used_s, used_c = int(row.get("ai_seconds", 0)), float(row.get("cost_cents", 0.0))
        lim_s, lim_c = self._limits(tier, regional_tier)
        reason = None
        if self._global_killed(day):
            reason = "global_kill_switch"
        elif used_c >= lim_c:
            reason = "cost_cents"
        elif used_s >= lim_s:
            reason = "fair_use" if tier == "pro" else "ai_minutes"
        return BudgetStatus(used_s, lim_s, used_c, lim_c, reason is not None, reason)

    def _global_killed(self, day: str) -> bool:
        cap = float(self.cfg.get("global_cost_kill_switch_cents_per_day", default=0) or 0)
        if cap <= 0:
            return False
        total = sum(float(r.get("cost_cents", 0.0)) for r in self.store.select("usage_daily", day=day))
        return total >= cap

    def charge(self, user_id: str, seconds: float, cents: float, now: datetime | None = None) -> None:
        day = today_key(now)
        row = self.store.get("usage_daily", user_id=user_id, day=day) or {"user_id": user_id, "day": day, "ai_seconds": 0, "cost_cents": 0.0}
        row["ai_seconds"] = int(row.get("ai_seconds", 0)) + int(round(seconds))
        row["cost_cents"] = float(row.get("cost_cents", 0.0)) + float(cents)
        self.store.upsert("usage_daily", row)

    def can_spend(self, user_id: str, tier: str, regional_tier: str = "tier1", now: datetime | None = None) -> BudgetStatus:
        return self.status(user_id, tier, regional_tier, now)
