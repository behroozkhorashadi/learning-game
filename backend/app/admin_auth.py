"""Shared-secret gate for admin-only endpoints (profile edit/delete today;
PRD §2 still has no real accounts/auth).

This is deliberately not real auth: the password is sent as a plain header
over plain HTTP, and the frontend has to hold it in memory to attach that
header — anyone with browser dev tools open during an admin session can read
it. Its only job is to stop a curious kid from finding these endpoints with
curl and wiping a profile — not to withstand a motivated attacker. If this
app ever leaves the LAN, replace this before relying on it for anything
real.

The password itself lives in `backend/.env` (gitignored — see
`backend/.env.example` for the key), loaded via `app/__init__.py`'s
`load_dotenv()`, not hardcoded here. When it is absent, the rest of the app
remains available but admin-only operations return 503.
"""

import os
from typing import Optional

from fastapi import Header, HTTPException
from pydantic import BaseModel

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")


class AdminLoginRequest(BaseModel):
    password: str


def verify_admin_password(password: Optional[str]) -> None:
    if not ADMIN_PASSWORD:
        raise HTTPException(status_code=503, detail="admin features are unavailable")
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="invalid admin password")


def require_admin(x_admin_password: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency — attach to any endpoint that should require the
    admin password, sent as the `X-Admin-Password` header."""
    verify_admin_password(x_admin_password)
