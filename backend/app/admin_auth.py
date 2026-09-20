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
`load_dotenv()`, not hardcoded here. The app refuses to start without it.
"""

import os
from typing import Optional

from fastapi import Header, HTTPException
from pydantic import BaseModel

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    raise RuntimeError(
        "ADMIN_PASSWORD is not set. Add it to backend/.env (see backend/.env.example) "
        "before starting the server."
    )


class AdminLoginRequest(BaseModel):
    password: str


def require_admin(x_admin_password: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency — attach to any endpoint that should require the
    admin password, sent as the `X-Admin-Password` header."""
    if x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="invalid admin password")
