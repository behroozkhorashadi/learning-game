import pytest
from pydantic import ValidationError

from app.practice.practice_schemas_pure import PracticeConfig, PracticeConfigUpsert
from tests.practice.practice_fakes import START


def test_upsert_defaults_focus_numbers_to_empty() -> None:
    parsed = PracticeConfigUpsert.model_validate(
        {"profile_id": 1, "game_id": "g", "operations": ["+"], "difficulty": 2}
    )
    assert parsed.focus_numbers == {}


def test_upsert_rejects_wrong_types() -> None:
    with pytest.raises(ValidationError):
        PracticeConfigUpsert.model_validate({"profile_id": "x", "game_id": "g", "operations": "+", "difficulty": 2})


def test_config_needs_its_timestamp_from_the_server() -> None:
    body = {"profile_id": 1, "game_id": "g", "operations": ["+"], "difficulty": 2}
    with pytest.raises(ValueError, match="set by the server"):
        PracticeConfig.model_validate(body)
    assert PracticeConfig.model_validate({**body, "updated_at": START}).updated_at == START


def test_published_schema_keeps_server_set_fields_optional() -> None:
    assert PracticeConfig.model_json_schema()["required"] == ["profile_id", "game_id", "operations", "difficulty"]
