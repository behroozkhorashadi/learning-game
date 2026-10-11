import pytest

from app.armory.armory_ports_pure import (
    ArtStudioService,
    ArtUnavailableError,
    NotEnoughPointsError,
    ProfileNotFoundError,
)
from app.armory.armory_reducers_pure import summarize
from app.armory.armory_schemas_pure import ArtCreate
from app.armory.art_studio_service_effect import make_art_studio_service
from tests.armory.armory_fakes import (
    NOW,
    SELFIE,
    FakeArtMaker,
    InMemoryArtStore,
    InMemoryArtStudioRepository,
    SequentialIds,
    clock,
    earned,
    profile_exists,
)


def studio(
    maker: FakeArtMaker, points: int = 500
) -> tuple[ArtStudioService, InMemoryArtStudioRepository, InMemoryArtStore]:
    repository = InMemoryArtStudioRepository()
    repository.append([earned(points)])
    store = InMemoryArtStore()
    service = make_art_studio_service(
        repository=repository,
        profile_exists=profile_exists,
        art_maker=maker,
        art_store=store,
        clock=clock,
        new_id=SequentialIds(),
    )
    return service, repository, store


def request() -> ArtCreate:
    return ArtCreate(image_data_url=SELFIE, style="zombie_slayer", idea="a cape")


def test_making_art_keeps_it_and_charges_for_it() -> None:
    maker = FakeArtMaker()
    service, repository, store = studio(maker)
    result = service.create_art(1, request())
    assert result.piece.image_url == "/static/armory-art/1.jpg"
    assert (result.piece.id, result.piece.style, result.piece.idea, result.piece.created_at) == (
        "art-1",
        "zombie_slayer",
        "a cape",
        NOW,
    )
    assert result.armory.balance == 200
    assert service.gallery(1) == (result.piece,)
    assert store.saved[0].content_type == "image/jpeg"
    assert "a cape" in maker.prompts[0]
    assert summarize(1, repository.entries_for(1)).spent == 300


def test_an_unavailable_ai_costs_nothing() -> None:
    service, repository, _ = studio(FakeArtMaker(available=False))
    with pytest.raises(ArtUnavailableError):
        service.create_art(1, request())
    assert summarize(1, repository.entries_for(1)).balance == 500
    assert service.gallery(1) == ()


def test_not_enough_points_never_calls_the_ai() -> None:
    maker = FakeArtMaker()
    service, _, _ = studio(maker, points=299)
    with pytest.raises(NotEnoughPointsError):
        service.create_art(1, request())
    assert maker.prompts == []


def test_unknown_profile() -> None:
    service, _, _ = studio(FakeArtMaker())
    with pytest.raises(ProfileNotFoundError):
        service.gallery(9)
