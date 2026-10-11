"""Startup seeding, the demo-profile policy, and the read access other features use."""

from pathlib import Path

from app.profiles.profiles_schemas_pure import LocalSeedProfile, NewProfile, ProfileCreate
from tests.profiles.profiles_fakes import START, YEAR, harness


def _create(name: str) -> ProfileCreate:
    return ProfileCreate(name=name, avatar="owl", birth_year=YEAR - 7)


def test_seed_adds_the_demo_to_an_empty_database_once(tmp_path: Path) -> None:
    setup = harness(tmp_path)
    setup.service.seed(None)
    setup.service.seed(None)
    assert [(p.id, p.name) for p in setup.service.list_profiles()] == [(1, "Demo Kid")]


def test_seed_does_not_add_the_demo_when_a_real_profile_exists(tmp_path: Path) -> None:
    setup = harness(tmp_path)
    setup.service.create_profile(_create("Real Kid"))
    setup.service.seed(None)
    assert [p.name for p in setup.service.list_profiles()] == ["Real Kid"]


def test_local_tester_gets_id_2_and_replaces_the_demo(tmp_path: Path) -> None:
    setup = harness(tmp_path)
    setup.service.seed(None)
    setup.service.seed(LocalSeedProfile(name="Rami", avatar="rami", birth_year=2019))
    assert [(p.id, p.name) for p in setup.service.list_profiles()] == [(2, "Rami")]
    assert setup.erased.erased == [1]


def test_seed_backfills_photo_avatars_into_the_saved_list(tmp_path: Path) -> None:
    setup = harness(tmp_path)
    legacy = setup.repository.insert(
        NewProfile(
            id=None,
            name="Legacy",
            avatar="/static/profile-avatars/old.jpg",
            birth_year=YEAR - 7,
            reading_support=False,
            created_at=START,
        )
    )
    setup.service.seed(None)
    setup.service.seed(None)  # idempotent
    saved = setup.service.list_photos(legacy.id, None, None)
    assert [(p.url, p.label) for p in saved] == [("/static/profile-avatars/old.jpg", "Photo")]


def test_lookups_for_other_features(tmp_path: Path) -> None:
    setup = harness(tmp_path)
    ada = setup.service.create_profile(_create("Ada"))
    assert ada.id is not None
    assert setup.service.exists(ada.id)
    assert not setup.service.exists(99)
    assert setup.service.birth_year(ada.id) == YEAR - 7
    assert setup.service.birth_year(99) is None
    assert setup.service.names([ada.id, 99]) == {ada.id: "Ada"}
