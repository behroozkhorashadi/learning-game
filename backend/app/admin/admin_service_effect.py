"""The admin password check, over the password assembly reads from settings."""

import hmac

from app.admin.admin_ports_pure import AdminService, InvalidAdminPasswordError


def make_admin_service(*, admin_password: str) -> AdminService:
    """`admin_password` must be non-empty (settings guarantee it), so a missing or
    empty attempt never matches."""
    expected = admin_password.encode()

    def is_admin_password(password: str | None) -> bool:
        return hmac.compare_digest((password or "").encode(), expected)

    def verify(password: str | None) -> None:
        if not is_admin_password(password):
            raise InvalidAdminPasswordError

    return AdminService(is_admin_password=is_admin_password, verify=verify)
