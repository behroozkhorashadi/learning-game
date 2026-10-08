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
`load_dotenv()`, not hardcoded here. The app refuses to start without it:
an unset or empty `ADMIN_PASSWORD` raises at import, so a misconfigured
deploy fails loudly instead of coming up with the admin gate wide open.
"""

import os
from typing import Optional

from fastapi import Header, HTTPException
from pydantic import BaseModel

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD") or ""
if not ADMIN_PASSWORD:
    raise RuntimeError(
        "ADMIN_PASSWORD is not set. Add it to backend/.env (see backend/.env.example) "
        "before starting the server."
    )


class AdminLoginRequest(BaseModel):
    password: str


def verify_admin_password(password: Optional[str]) -> None:
    """Raises 401 unless `password` matches. A missing header (`None`) never
    matches, since `ADMIN_PASSWORD` is guaranteed non-empty."""
    if (password or "") != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="invalid admin password")


def require_admin(x_admin_password: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency — attach to any endpoint that should require the
    admin password, sent as the `X-Admin-Password` header."""
    verify_admin_password(x_admin_password)
