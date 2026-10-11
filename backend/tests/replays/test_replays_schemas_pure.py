import pytest
from pydantic import ValidationError

from app.replays.replays_schemas_pure import ReplayCreate


def test_a_recording_is_any_json_object() -> None:
    created = ReplayCreate.model_validate(
        {"outcome": "left", "duration_ms": 5, "flags": 0, "recording": {"a": [1, None, {"b": "c"}]}}
    )
    assert created.recording == {"a": [1, None, {"b": "c"}]}


@pytest.mark.parametrize(
    "body",
    [
        {"outcome": "", "duration_ms": 5, "flags": 0, "recording": {}},
        {"outcome": "left", "duration_ms": -1, "flags": 0, "recording": {}},
        {"outcome": "left", "duration_ms": 5, "flags": 0, "recording": [1, 2]},
    ],
)
def test_rejects_malformed_bodies(body: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        ReplayCreate.model_validate(body)
