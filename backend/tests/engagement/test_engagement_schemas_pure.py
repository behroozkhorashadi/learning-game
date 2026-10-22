import pytest
from pydantic import ValidationError

from app.engagement.engagement_schemas_pure import EngagementBatch


def test_batch_accepts_aggregate_active_time() -> None:
    batch = EngagementBatch.model_validate(
        {"spans": [{"area": "zombie_horde:gameplay", "active_ms": 5000, "profile_id": 2}]}
    )
    assert batch.spans[0].area == "zombie_horde:gameplay"


@pytest.mark.parametrize(
    "span",
    [
        {"area": "", "active_ms": 1},
        {"area": "private data!", "active_ms": 1},
        {"area": "home", "active_ms": 0},
        {"area": "home", "active_ms": 60_001},
    ],
)
def test_batch_rejects_invalid_or_excessive_spans(span: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        EngagementBatch.model_validate({"spans": [span]})
