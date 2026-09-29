"""Security-Header, Body-Limit, Rate-Limits (Token-Bucket, In-Memory; Redis-Variante bei REDIS_URL)."""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import socket
import time
from collections import defaultdict
from urllib.parse import urlparse

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

MAX_BODY_BYTES = 6 * 1024 * 1024  # Audio-Turn (~30 s WAV 16 kHz mono ~ 1 MB als Base64 ~1.4 MB)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
            return JSONResponse({"detail": "payload too large"}, status_code=413)
        resp = await call_next(request)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.setdefault("Cache-Control", "no-store")
        resp.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return resp


class RateLimiter:
    """Token-Bucket je (Schluessel, Bucket). `rate` Tokens pro Sekunde, `burst` Kapazitaet."""

    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.state: dict[tuple[str, str], tuple[float, float]] = defaultdict(lambda: (0.0, 0.0))
        self.initialized: set[tuple[str, str]] = set()

    def allow(self, key: str, bucket: str, rate: float, burst: int) -> bool:
        k = (key, bucket)
        now = self.clock()
        if k not in self.initialized:
            self.initialized.add(k)
            tokens, last = float(burst), now
        else:
            tokens, last = self.state[k]
        tokens = min(burst, tokens + (now - last) * rate)
        if tokens < 1:
            self.state[k] = (tokens, now)
            return False
        self.state[k] = (tokens - 1, now)
        return True


LIMITS = {"voice": (0.2, 12), "exercise": (2.0, 30), "default": (5.0, 60), "webhook": (5.0, 30)}


def enforce(request: Request, user_key: str, bucket: str = "default") -> None:
    rate, burst = LIMITS[bucket]
    if not request.app.state.limiter.allow(user_key, bucket, rate, burst):
        raise HTTPException(429, "rate limit exceeded", headers={"Retry-After": "5"})


def safe_compare(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def sign(secret: str, timestamp: str, body: bytes) -> str:
    return hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()


def assert_public_https_url(url: str, resolve: bool = True) -> str:
    """SSRF-Schutz: nur https, kein privates/Loopback-Ziel."""
    p = urlparse(url)
    if p.scheme != "https" or not p.hostname:
        raise ValueError("only https URLs allowed")
    host = p.hostname
    try:
        ips = [ipaddress.ip_address(host)]
    except ValueError:
        ips = []
        if resolve:
            try:
                ips = [ipaddress.ip_address(i[4][0]) for i in socket.getaddrinfo(host, p.port or 443)]
            except socket.gaierror as e:
                raise ValueError("host does not resolve") from e
    for ip in ips:
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            raise ValueError("non-public address")
    if host in ("localhost",) or host.endswith(".internal") or host.endswith(".local"):
        raise ValueError("non-public host")
    return url
