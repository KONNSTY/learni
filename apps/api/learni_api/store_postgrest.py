"""Supabase-Store ueber PostgREST (serverseitig mit Service-Role-Key, umgeht RLS bewusst).

Der Key existiert nur im Backend. Jede Methode erzwingt Filter auf user_id in den Routen,
nie Client-Eingaben als Tabellen- oder Spaltennamen (Tabellen stammen aus KEYS).
"""
from __future__ import annotations

from typing import Any

import httpx

from .store import KEYS


class PostgrestStore:
    def __init__(self, base_url: str, service_key: str, client: httpx.Client | None = None):
        self.base = base_url.rstrip("/")
        self.service_key = service_key
        self.http = client or httpx.Client(timeout=10.0)

    def _h(self, prefer: str | None = None) -> dict[str, str]:
        h = {"apikey": self.service_key, "Authorization": f"Bearer {self.service_key}", "Content-Type": "application/json"}
        if prefer:
            h["Prefer"] = prefer
        return h

    @staticmethod
    def _q(filters: dict[str, Any]) -> dict[str, str]:
        return {k: f"eq.{v}" for k, v in filters.items()}

    def _check(self, table: str) -> None:
        if table not in KEYS:
            raise ValueError(f"unknown table {table}")

    def get(self, table: str, **key: Any) -> dict[str, Any] | None:
        rows = self.select(table, **key)
        return rows[0] if rows else None

    def select(self, table: str, **filters: Any) -> list[dict[str, Any]]:
        self._check(table)
        r = self.http.get(f"{self.base}/rest/v1/{table}", params=self._q(filters), headers=self._h())
        r.raise_for_status()
        return r.json()

    def upsert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        self._check(table)
        r = self.http.post(
            f"{self.base}/rest/v1/{table}",
            params={"on_conflict": ",".join(KEYS[table])},
            json=row,
            headers=self._h("resolution=merge-duplicates,return=representation"),
        )
        r.raise_for_status()
        data = r.json()
        return data[0] if data else row

    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        self._check(table)
        r = self.http.post(f"{self.base}/rest/v1/{table}", json=row, headers=self._h("return=representation"))
        r.raise_for_status()
        data = r.json()
        return data[0] if data else row

    def delete(self, table: str, **filters: Any) -> int:
        self._check(table)
        if not filters:
            raise ValueError("refusing unfiltered delete")
        r = self.http.delete(f"{self.base}/rest/v1/{table}", params=self._q(filters), headers=self._h("return=representation"))
        r.raise_for_status()
        return len(r.json())

    def delete_auth_user(self, user_id: str) -> None:
        """Supabase Admin API: loescht auth.users-Eintrag."""
        r = self.http.delete(f"{self.base}/auth/v1/admin/users/{user_id}", headers=self._h())
        if r.status_code not in (200, 204, 404):
            r.raise_for_status()
