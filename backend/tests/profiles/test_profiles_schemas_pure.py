import pytest
from pydantic import ValidationError

from app.profiles.profiles_schemas_pure import ProfileCreate, ProfileRecord, ProfileUpdate
from tests.profiles.profiles_fakes import START


def test_create_defaults() -> None:
    parsed = ProfileCreate.model_validate({"name": "A", "avatar": "fox", "birth_year": 2019})
    assert (parsed.reading_support, parsed.new_photos, parsed.password) == (False, [], None)


def test_update_fields_are_all_optional() -> None:
    assert ProfileUpdate.model_validate({}).model_dump() == {
        "name": None,
        "avatar": None,
        "birth_year": None,
        "reading_support": None,
        "new_photos": [],
        "password": None,
        "remove_password": False,
        "parent_id": None,
        "remove_parent": False,
    }


def test_records_reject_unknown_columns() -> None:
    row = {"id": 1, "name": "A", "avatar": "fox", "birth_year": 2019, "reading_support": False, "created_at": START}
    assert ProfileRecord.model_validate(row).id == 1
    with pytest.raises(ValidationError):
        ProfileRecord.model_validate({**row, "password_hash": "x"})
