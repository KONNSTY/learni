"""Persistenz-Interface. MemoryStore (Tests/Dev) und PostgrestStore (Supabase) teilen die Semantik.

Tabellen und Schluessel (siehe supabase/migrations):
profiles(user_id) memberships(user_id) learner_state(user_id,language)
item_states(user_id,language,item_id) tutor_profiles(user_id,language)
usage_daily(user_id,day) issued_exercises(user_id,exercise_id) analytics_events(id)
"""
from __future__ import annotations

import copy
import itertools
from typing import Any, Protocol

KEYS: dict[str, tuple[str, ...]] = {
    "profiles": ("user_id",),
    "memberships": ("user_id",),
    "learner_state": ("user_id", "language"),
    "item_states": ("user_id", "language", "item_id"),
    "tutor_profiles": ("user_id", "language"),
    "usage_daily": ("user_id", "day"),
    "issued_exercises": ("user_id", "exercise_id"),
    "analytics_events": ("id",),
}
USER_TABLES = tuple(t for t in KEYS if t != "analytics_events") + ("analytics_events",)


class Store(Protocol):
    def get(self, table: str, **key: Any) -> dict[str, Any] | None: ...
    def upsert(self, table: str, row: dict[str, Any]) -> dict[str, Any]: ...
    def select(self, table: str, **filters: Any) -> list[dict[str, Any]]: ...
    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]: ...
    def delete(self, table: str, **filters: Any) -> int: ...
    def delete_auth_user(self, user_id: str) -> None: ...


class MemoryStore:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict[str, Any]]] = {t: [] for t in KEYS}
        self.auth_users_deleted: list[str] = []
        self._ids = itertools.count(1)

    def _match(self, row: dict[str, Any], filters: dict[str, Any]) -> bool:
        return all(row.get(k) == v for k, v in filters.items())

    def get(self, table: str, **key: Any) -> dict[str, Any] | None:
        for row in self.tables[table]:
            if self._match(row, key):
                return copy.deepcopy(row)
        return None

    def upsert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        key = {k: row[k] for k in KEYS[table]}
        for i, existing in enumerate(self.tables[table]):
            if self._match(existing, key):
                merged = {**existing, **copy.deepcopy(row)}
                self.tables[table][i] = merged
                return copy.deepcopy(merged)
        self.tables[table].append(copy.deepcopy(row))
        return copy.deepcopy(row)

    def select(self, table: str, **filters: Any) -> list[dict[str, Any]]:
        return [copy.deepcopy(r) for r in self.tables[table] if self._match(r, filters)]

    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        row = copy.deepcopy(row)
        if "id" in KEYS[table] and "id" not in row:
            row["id"] = next(self._ids)
        self.tables[table].append(row)
        return copy.deepcopy(row)

    def delete(self, table: str, **filters: Any) -> int:
        keep = [r for r in self.tables[table] if not self._match(r, filters)]
        n = len(self.tables[table]) - len(keep)
        self.tables[table] = keep
        return n

    def delete_auth_user(self, user_id: str) -> None:
        self.auth_users_deleted.append(user_id)
