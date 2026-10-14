import pytest

from app.armory.armory_ports_pure import LookLockedError, ProfileNotFoundError
from app.armory.armory_schemas_pure import ArmoryLooks, HungPictures, SuitPaint
from app.armory.looks_service_effect import make_looks_service
from tests.armory.armory_fakes import InMemoryLooksRepository, art_piece, bought, profile_exists


@pytest.fixture
def repository() -> InMemoryLooksRepository:
    return InMemoryLooksRepository()


def test_the_default_look_until_first_saved(repository: InMemoryLooksRepository) -> None:
    service = make_looks_service(repository=repository, profile_exists=profile_exists)
    state = service.state(1)
    assert (state.looks, state.pictures) == (ArmoryLooks(), {})


def test_saved_looks_come_back_with_their_pictures(repository: InMemoryLooksRepository) -> None:
    repository.append([bought("suit_paint"), bought("pathfinder_frame")])
    repository.add_art(art_piece("a1"))
    service = make_looks_service(repository=repository, profile_exists=profile_exists)
    looks = ArmoryLooks(suit_paint=SuitPaint(color="#FF00AA", shine="shiny"), hung=HungPictures(pathfinder="a1"))
    saved = service.save(1, looks)
    assert saved.pictures == {"a1": "/static/armory-art/a1.jpg"}
    assert service.state(1) == saved
    assert service.state(2).looks == ArmoryLooks()


def test_locked_looks_are_not_saved(repository: InMemoryLooksRepository) -> None:
    service = make_looks_service(repository=repository, profile_exists=profile_exists)
    with pytest.raises(LookLockedError):
        service.save(1, ArmoryLooks(blaster_color="#00FF88"))
    assert repository.looks == {}


def test_unknown_profiles_are_refused(repository: InMemoryLooksRepository) -> None:
    service = make_looks_service(repository=repository, profile_exists=profile_exists)
    with pytest.raises(ProfileNotFoundError):
        service.state(9)
    with pytest.raises(ProfileNotFoundError):
        service.save(9, ArmoryLooks())
