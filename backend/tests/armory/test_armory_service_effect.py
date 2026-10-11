import pytest

from app.armory.armory_ports_pure import ArmoryService, NotEnoughPointsError, ProfileNotFoundError
from app.armory.armory_reducers_pure import STARTING_GRENADES
from app.armory.armory_schemas_pure import ArmoryRoundCreate
from app.armory.armory_service_effect import make_armory_service
from tests.armory.armory_fakes import InMemoryArmoryRepository, clock, profile_exists


@pytest.fixture
def service() -> ArmoryService:
    return make_armory_service(repository=InMemoryArmoryRepository(), profile_exists=profile_exists, clock=clock)


def test_rounds_add_up_per_profile(service: ArmoryService) -> None:
    service.record_round(1, ArmoryRoundCreate(points=100, grenades_used=0))
    state = service.record_round(1, ArmoryRoundCreate(points=50, grenades_used=0))
    assert state.balance == 150
    assert service.state(2).balance == 0


def test_a_round_cannot_spend_grenades_it_does_not_have(service: ArmoryService) -> None:
    state = service.record_round(1, ArmoryRoundCreate(points=0, grenades_used=STARTING_GRENADES + 3))
    assert state.grenades == 0
    assert service.record_round(1, ArmoryRoundCreate(points=0, grenades_used=1)).grenades == 0


def test_buying_then_buying_the_next_tier(service: ArmoryService) -> None:
    service.record_round(1, ArmoryRoundCreate(points=900, grenades_used=0))
    service.purchase(1, "rapid_blaster")
    state = service.purchase(1, "mega_blaster")
    assert state.balance == 50
    assert {"rapid_blaster", "mega_blaster"} <= set(state.owned)
    with pytest.raises(NotEnoughPointsError):
        service.purchase(1, "armor_piercing")


def test_unknown_profile(service: ArmoryService) -> None:
    with pytest.raises(ProfileNotFoundError):
        service.state(9)
    with pytest.raises(ProfileNotFoundError):
        service.purchase(9, "grenade_pack")
