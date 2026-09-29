"""Paywall-Trigger (Spec 4.2 [ANNAHME]). Rein deterministisch, zentral im Backend."""
from __future__ import annotations

TRIGGERS = ("hearts_empty", "ai_minutes_exhausted", "pro_feature", "streak_at_risk", "onboarding_plan")


def for_budget(reason: str | None) -> str | None:
    if reason in ("ai_minutes", "cost_cents"):
        return "ai_minutes_exhausted"
    return None  # fair_use (Pro) und Kill-Switch zeigen keine Paywall, sondern Fallback-Content


def for_hearts(hearts: int, unlimited: bool) -> str | None:
    return "hearts_empty" if (not unlimited and hearts <= 0) else None
