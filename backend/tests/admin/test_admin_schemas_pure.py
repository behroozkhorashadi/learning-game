import pytest
from pydantic import ValidationError

from app.admin.admin_schemas_pure import AdminLoginRequest


def test_login_needs_a_password_string() -> None:
    assert AdminLoginRequest.model_validate({"password": ""}).password == ""
    with pytest.raises(ValidationError):
        AdminLoginRequest.model_validate({})
