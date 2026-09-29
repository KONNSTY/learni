"""KPI-Auswertung aus analytics_events / usage_daily / profiles (Spec 8: D1, D7, D30, Trial, COGS, ARPDAU, Latenz, Fehlerrate)."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any

from .store import Store


def _d(v: Any) -> date:
    return v.date() if isinstance(v, datetime) else datetime.fromisoformat(str(v)).date()


def retention(store: Store, day_n: int, as_of: date) -> float | None:
    """Anteil der Nutzer, die an Tag `n` nach ihrer Registrierung `app_open` hatten (nur Kohorten, die alt genug sind)."""
    opens: dict[str, set[date]] = defaultdict(set)
    for e in store.select("analytics_events", name="app_open"):
        opens[e["user_id"]].add(_d(e["ts"]))
    cohort = [p for p in store.tables.get("profiles", []) if (as_of - _d(p["created_at"])).days >= day_n] if hasattr(store, "tables") else []
    if not cohort:
        return None
    hit = sum(1 for p in cohort if any((o - _d(p["created_at"])).days == day_n for o in opens.get(p["user_id"], ())))
    return round(hit / len(cohort), 4)


def report(store: Store, as_of: date, latency_p95_ms: float | None = None) -> dict[str, Any]:
    events = store.select("analytics_events") if hasattr(store, "select") else []
    by_name: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for e in events:
        by_name[e["name"]].append(e)
    day = as_of.isoformat()
    usage = store.select("usage_daily", day=day)
    dau_ids = {e["user_id"] for e in by_name["app_open"] if _d(e["ts"]) == as_of} | {u["user_id"] for u in usage}
    dau = len(dau_ids)
    trials = len({e["user_id"] for e in by_name["trial_start"]})
    converted = len({e["user_id"] for e in by_name["trial_converted"]})
    cogs_cents = sum(float(u.get("cost_cents", 0.0)) for u in usage)
    ad_rev = sum(float((e.get("props") or {}).get("revenue_cents", 0.0)) for e in by_name["ad_impression"] if _d(e["ts"]) == as_of)
    voice, errors = defaultdict(int), defaultdict(int)
    for e in by_name["voice_turn"]:
        voice[e.get("language") or "?"] += 1
    for e in by_name["error"]:
        errors[e.get("language") or "?"] += 1
    return {
        "as_of": day, "dau": dau,
        "retention": {f"d{n}": retention(store, n, as_of) for n in (1, 7, 30)},
        "trial_starts": trials, "trial_to_paid": round(converted / trials, 4) if trials else None,
        "cogs_cents_per_dau": round(cogs_cents / dau, 4) if dau else None,
        "ad_arpdau_cents": round(ad_rev / dau, 4) if dau else None,
        "latency_p95_ms": latency_p95_ms,
        "error_rate_per_language": {lang: round(errors[lang] / max(voice[lang] + errors[lang], 1), 4) for lang in set(voice) | set(errors)},
    }
