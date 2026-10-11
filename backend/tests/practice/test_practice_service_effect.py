import pytest

from app.practice.practice_ports_pure import (
    InvalidPracticeConfigError,
    PracticeConfigNotFoundError,
    PracticeService,
    ProfileNotFoundError,
    UnknownGameError,
)
from app.practice.practice_service_effect import make_practice_service
from tests.practice.practice_fakes import (
    OPERATORS,
    InMemoryPracticeConfigRepository,
    ManualClock,
    known_game,
    upsert,
)


@pytest.fixture
def clock() -> ManualClock:
    return ManualClock()


@pytest.fixture
def service(clock: ManualClock) -> PracticeService:
    return make_practice_service(
        repository=InMemoryPracticeConfigRepository(),
        profile_exists=lambda profile_id: profile_id == 1,
        games=known_game,
        operators=OPERATORS,
        clock=clock,
    )


def test_put_then_get_and_replace(service: PracticeService, clock: ManualClock) -> None:
    created = service.put_config(upsert(difficulty=3))
    clock.advance(60)
    replaced = service.put_config(upsert(difficulty=6))
    assert replaced.id == created.id
    assert service.get_config(1, "fact_fluency").difficulty == 6
    assert service.get_config(1, "fact_fluency").updated_at == clock.now


def test_get_and_delete_without_a_config_are_not_found(service: PracticeService) -> None:
    with pytest.raises(PracticeConfigNotFoundError):
        service.get_config(1, "fact_fluency")
    with pytest.raises(PracticeConfigNotFoundError):
        service.delete_config(1, "fact_fluency")


def test_delete_reverts_to_no_config(service: PracticeService) -> None:
    service.put_config(upsert())
    service.delete_config(1, "fact_fluency")
    with pytest.raises(PracticeConfigNotFoundError):
        service.get_config(1, "fact_fluency")


def test_unknown_profile_and_game(service: PracticeService) -> None:
    with pytest.raises(ProfileNotFoundError, match="no profile with id 9"):
        service.put_config(upsert(profile_id=9))
    with pytest.raises(UnknownGameError) as raised:
        service.put_config(upsert(game_id="nope"))
    assert str(raised.value) == "\"no game registered with id 'nope'\""


def test_invalid_upsert_is_not_saved(service: PracticeService) -> None:
    with pytest.raises(InvalidPracticeConfigError):
        service.put_config(upsert(game_id="syllable_builder"))
    with pytest.raises(PracticeConfigNotFoundError):
        service.get_config(1, "syllable_builder")
