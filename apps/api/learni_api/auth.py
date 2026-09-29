"""Supabase-JWT-Pruefung (HS256). Dev-Token `dev:<uuid>` nur bei APP_ENV=dev."""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

import jwt
from fastapi import HTTPException, Request

from .config import Settings

DEV_RE = re.compile(r"^dev:([0-9a-fA-F-]{36})$")


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    email: str | None = None
    is_dev: bool = False
    email_verified: bool | None = None  # None = kein E-Mail-Login (Apple/Google/anonym) oder Dev


def verify_token(token: str, settings: Settings) -> AuthUser:
    m = DEV_RE.match(token)
    if m:
        if not settings.is_dev:
            raise HTTPException(401, "invalid token")
        try:
            uuid.UUID(m.group(1))
        except ValueError:
            raise HTTPException(401, "invalid token") from None
        return AuthUser(m.group(1).lower(), None, True)
    if not settings.supabase_jwt_secret:
        raise HTTPException(401, "invalid token")
    try:
        claims = jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated", options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid token") from None
    try:
        uuid.UUID(str(claims["sub"]))
    except ValueError:
        raise HTTPException(401, "invalid token") from None
    meta = claims.get("user_metadata") or {}
    verified = meta.get("email_verified") if claims.get("email") and (claims.get("app_metadata") or {}).get("provider") == "email" else None
    return AuthUser(str(claims["sub"]).lower(), claims.get("email"), False, verified)


def current_user(request: Request) -> AuthUser:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "missing bearer token")
    user = verify_token(token.strip(), request.app.state.settings)
    # Feature-Flag (Standard aus): E-Mail-Verifikationszwang fuer E-Mail-Logins
    if request.app.state.cfg.flag("require_email_verification") and user.email_verified is False:
        raise HTTPException(403, "email_not_verified")
    return user
