"""Optional per-profile passwords — hashing and the "may this request act as
this profile?" check.

Same trust model as `app/admin_auth.py`: this keeps a sibling from opening or
editing someone else's profile on the family LAN, not a motivated attacker.
The password is checked when a kid picks their profile (POST
/api/profiles/{id}/unlock) and on every profile edit (PATCH), but the game
endpoints themselves still trust whatever profile id the client sends.

The admin password works as an override anywhere a profile password is asked
for — but only when an admin password is actually configured. With
`ADMIN_PASSWORD` unset the admin password is the empty string, and letting
that through here would make every profile password bypassable by leaving
the box blank.
"""

from __future__ import annotations

import hashlib
import hmac
import os
from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session

from app import admin_auth
from app.models.profile import ProfilePassword

MIN_PASSWORD_LENGTH = 4
MAX_PASSWORD_LENGTH = 128

# hashlib.scrypt with the parameters Python's docs suggest for interactive
# logins — stdlib only, so no new dependency for a LAN-grade gate.
_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P)
    return f"scrypt${salt.hex()}${digest.hex()}"


def _matches_hash(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "scrypt":
        return False
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P)
    return hmac.compare_digest(digest.hex(), digest_hex)


def is_admin_override(password: Optional[str]) -> bool:
    configured = admin_auth.ADMIN_PASSWORD
    return bool(configured) and hmac.compare_digest((password or "").encode(), configured.encode())


def validated_new_password(password: str) -> str:
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters",
        )
    return password


def has_password(session: Session, profile_id: int) -> bool:
    return session.get(ProfilePassword, profile_id) is not None


def set_password(session: Session, profile_id: int, password: str) -> None:
    row = session.get(ProfilePassword, profile_id) or ProfilePassword(profile_id=profile_id, password_hash="")
    row.password_hash = hash_password(validated_new_password(password))
    session.add(row)


def remove_password(session: Session, profile_id: int) -> None:
    row = session.get(ProfilePassword, profile_id)
    if row is not None:
        session.delete(row)


def require_profile_access(
    session: Session, profile_id: int, profile_password: Optional[str], admin_password: Optional[str]
) -> None:
    """Raises 401 unless the request may act as this profile: the profile has
    no password, or `profile_password` is its password, or either header
    carries the (configured) admin password."""
    row = session.get(ProfilePassword, profile_id)
    if row is None:
        return
    if profile_password and _matches_hash(profile_password, row.password_hash):
        return
    if is_admin_override(profile_password) or is_admin_override(admin_password):
        return
    raise HTTPException(status_code=401, detail="wrong password for this profile")
