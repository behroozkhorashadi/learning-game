"""The admin password gate's commands and its one error.

Deliberately not real auth (PRD §2 has no accounts): the password is sent as a plain
header over plain HTTP, and the frontend holds it in memory to attach it. Its only
job is to stop a curious kid from finding the admin endpoints with curl and wiping a
profile, not to withstand a motivated attacker. If this app ever leaves the LAN,
replace it before relying on it for anything real.

The password itself is `AppSettings.admin_password` (from `backend/.env`); the app
refuses to start without it, so a misconfigured deploy fails loudly instead of
coming up with the gate wide open.
"""

from collections.abc import Callable
from dataclasses import dataclass


class InvalidAdminPasswordError(PermissionError):
    def __init__(self) -> None:
        super().__init__("invalid admin password")


@dataclass(frozen=True)
class AdminService:
    # Whether `password` is the admin password. A missing one (None) never is.
    is_admin_password: Callable[[str | None], bool]
    # Raises InvalidAdminPasswordError unless `password` is the admin password.
    verify: Callable[[str | None], None]
