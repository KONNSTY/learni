"""Signierte Webhook-Schnittstelle zu n8n (spaeter: E-Mail-Versand, Automationen). Keine Zugangsdaten im Code."""
from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from .config import Settings
from .security import assert_public_https_url, sign

log = logging.getLogger("learni.n8n")


def build_request(settings: Settings, event: str, data: dict[str, Any], now: float | None = None) -> tuple[str, dict[str, str], bytes]:
    """Erzeugt URL, Header (X-Learni-Timestamp/-Signature) und Body. HMAC-SHA256 ueber `<ts>.<body>`."""
    if not settings.n8n_base_url or not settings.n8n_webhook_secret:
        raise RuntimeError("n8n not configured")
    assert_public_https_url(settings.n8n_base_url)
    body = json.dumps({"event": event, "data": data}, separators=(",", ":"), sort_keys=True).encode()
    ts = str(int(now if now is not None else time.time()))
    url = f"{settings.n8n_base_url.rstrip('/')}/webhook/learni-{event.replace('.', '-')}"
    return url, {"Content-Type": "application/json", "X-Learni-Timestamp": ts, "X-Learni-Signature": sign(settings.n8n_webhook_secret, ts, body)}, body


async def notify(settings: Settings, event: str, data: dict[str, Any], client: httpx.AsyncClient | None = None) -> bool:
    """Best effort. Ohne Konfiguration: no-op (kein Fehler)."""
    if not settings.n8n_base_url or not settings.n8n_webhook_secret:
        return False
    try:
        url, headers, body = build_request(settings, event, data)
        c = client or httpx.AsyncClient(timeout=5.0)
        r = await c.post(url, content=body, headers=headers)
        return r.status_code < 300
    except (ValueError, RuntimeError, httpx.HTTPError) as e:
        log.warning("n8n notify failed: %s", type(e).__name__)
        return False
