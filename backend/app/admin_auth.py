"""Hardcoded shared-secret gate for admin-only endpoints (profile edit/delete
today; PRD §2 still has no real accounts/auth).

This is deliberately not real auth: the password lives in plain sight in the
frontend bundle and travels as a plain header over plain HTTP. Its only job
is to stop a curious kid from finding these endpoints with curl and wiping a
profile — not to withstand a motivated attacker. If this app ever leaves the
LAN, replace this before relying on it for anything real.

Override the default via the ADMIN_PASSWORD env var (e.g. in a `.env` picked
up by `make serve`) rather than editing the hardcoded value in source.
"""

import os
from typing import Optional

from fastapi import Header, HTTPException
from pydantic import BaseModel

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "parentcode123")


class AdminLoginRequest(BaseModel):
    password: str


def require_admin(x_admin_password: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency — attach to any endpoint that should require the
    admin password, sent as the `X-Admin-Password` header."""
    if x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="invalid admin password")
