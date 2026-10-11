import pytest
from pydantic import ValidationError

from app.play.play_schemas_pure import AttemptCreate, RatingCreate, RatingScale, TelemetryCore


def test_telemetry_core_needs_correctness_or_a_score() -> None:
    with pytest.raises(ValidationError, match="requires 'correct' and/or 'score'"):
        TelemetryCore.model_validate({"hints_used": 0, "time_ms": 1000})
    assert TelemetryCore.model_validate({"score": 0.5, "hints_used": 0, "time_ms": 1}).correct is None


@pytest.mark.parametrize("field", ["hints_used", "time_ms"])
def test_telemetry_counts_are_never_negative(field: str) -> None:
    with pytest.raises(ValidationError):
        TelemetryCore.model_validate({"correct": True, "hints_used": 0, "time_ms": 0, field: -1})


def test_attempt_details_default_to_empty() -> None:
    body = {
        "item_id": "i",
        "profile_id": 1,
        "game_id": "g",
        "telemetry": {"correct": True, "hints_used": 0, "time_ms": 1},
    }
    assert AttemptCreate.model_validate(body).details == {}


@pytest.mark.parametrize("value", [0, 6])
def test_ratings_are_one_to_five(value: int) -> None:
    with pytest.raises(ValidationError):
        RatingCreate.model_validate({"profile_id": 1, "game_id": "g", "scale": "faces", "value": value})
    assert RatingCreate.model_validate({"profile_id": 1, "game_id": "g", "scale": "faces", "value": 5}).scale is (
        RatingScale.FACES
    )
