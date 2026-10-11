import pytest

from app.admin.admin_ports_pure import InvalidAdminPasswordError
from app.admin.admin_service_effect import make_admin_service


def test_only_the_exact_password_is_the_admin_password() -> None:
    service = make_admin_service(admin_password="admin-secret")
    assert service.is_admin_password("admin-secret")
    for attempt in (None, "", "admin-secret ", "ADMIN-SECRET"):
        assert not service.is_admin_password(attempt)


def test_verify_raises_for_a_wrong_password() -> None:
    service = make_admin_service(admin_password="admin-secret")
    service.verify("admin-secret")
    with pytest.raises(InvalidAdminPasswordError, match="invalid admin password"):
        service.verify(None)
