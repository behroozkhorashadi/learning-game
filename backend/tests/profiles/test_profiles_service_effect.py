"""Startup seeding, the demo-profile policy, the read access other features use, and
linking a kid to a parent."""

from pathlib import Path

import pytest

from app.profiles.profiles_ports_pure import InvalidProfileError
from app.profiles.profiles_schemas_pure import LocalSeedProfile, NewProfile, ProfileCreate, ProfileUpdate
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


def test_kids_link_to_a_known_parent_and_can_move_or_unlink(tmp_path: Path) -> None:
    setup = harness(tmp_path)
    ada = setup.service.create_profile(_create("Ada").model_copy(update={"parent_id": 10}))
    bo = setup.service.create_profile(_create("Bo"))
    assert ada.id is not None
    assert bo.id is not None
    assert (ada.parent_id, bo.parent_id) == (10, None)
    assert [k.name for k in setup.service.kids_of(10)] == ["Ada"]

    moved = setup.service.update_profile(bo.id, ProfileUpdate(parent_id=10), None, None)
    assert moved.parent_id == 10
    assert [k.name for k in setup.service.kids_of(10)] == ["Ada", "Bo"]
    unlinked = setup.service.update_profile(bo.id, ProfileUpdate(remove_parent=True), None, None)
    assert unlinked.parent_id is None

    setup.service.unlink_parent(10)
    assert setup.service.kids_of(10) == ()


def test_linking_to_an_unknown_parent_or_both_link_and_unlink_is_rejected(tmp_path: Path) -> None:
    setup = harness(tmp_path)
    with pytest.raises(InvalidProfileError, match="no parent with id 99"):
        setup.service.create_profile(_create("Ada").model_copy(update={"parent_id": 99}))
    assert setup.service.list_profiles() == ()
    ada = setup.service.create_profile(_create("Ada"))
    assert ada.id is not None
    with pytest.raises(InvalidProfileError, match="either parent_id or remove_parent"):
        setup.service.update_profile(ada.id, ProfileUpdate(parent_id=10, remove_parent=True), None, None)
