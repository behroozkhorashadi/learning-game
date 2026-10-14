import pytest
from pydantic import ValidationError

from app.parents.parents_schemas_pure import ParentCreate, ParentRecord


def test_a_new_parent_needs_a_name_and_a_password() -> None:
    assert ParentCreate.model_validate({"name": "Mom", "password": "1234"}).password == "1234"
    with pytest.raises(ValidationError):
        ParentCreate.model_validate({"name": "Mom"})


def test_stored_records_reject_unknown_columns() -> None:
    with pytest.raises(ValidationError):
        ParentRecord.model_validate({"id": 1, "name": "Mom", "created_at": "2026-10-14T00:00:00", "extra": 1})
