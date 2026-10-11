import pytest
from pydantic import ValidationError

from app.armory.armory_schemas_pure import MAX_ROUND_POINTS, ArmoryPurchaseCreate, ArmoryRoundCreate


def test_a_round_accepts_points_up_to_the_ceiling() -> None:
    assert ArmoryRoundCreate.model_validate({"points": MAX_ROUND_POINTS, "grenades_used": 2}).points == MAX_ROUND_POINTS


@pytest.mark.parametrize(
    "body",
    [
        {"points": -1, "grenades_used": 0},
        {"points": MAX_ROUND_POINTS + 1, "grenades_used": 0},
        {"points": 10, "grenades_used": -1},
        {"points": 10, "grenades_used": 0, "bonus": 5},
        {"points": 10, "grenades_used": 0, "rounds_used": {"armor_piercing": -1}},
    ],
)
def test_a_round_rejects_impossible_bodies(body: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        ArmoryRoundCreate.model_validate(body)


def test_a_purchase_needs_an_item_id() -> None:
    with pytest.raises(ValidationError):
        ArmoryPurchaseCreate.model_validate({"item_id": ""})


def test_rounds_used_is_optional() -> None:
    assert ArmoryRoundCreate.model_validate({"points": 1, "grenades_used": 0}).rounds_used == {}
