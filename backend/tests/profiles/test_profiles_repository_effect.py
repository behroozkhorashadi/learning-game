from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect

from app.profiles.profiles_repository_effect import SqlProfileRepository, make_sql_profile_repository
from app.profiles.profiles_schemas_pure import NewProfile
from tests.profiles.profiles_fakes import START


@pytest.fixture
def repository(tmp_path: Path) -> SqlProfileRepository:
    repo = make_sql_profile_repository(engine=create_engine(f"sqlite:///{tmp_path / 'profiles.db'}"))
    repo.create_schema()
    return repo


def _new(name: str, *, profile_id: int | None = None, avatar: str = "fox") -> NewProfile:
    return NewProfile(id=profile_id, name=name, avatar=avatar, birth_year=2019, reading_support=False, created_at=START)


def test_keeps_the_existing_tables(repository: SqlProfileRepository) -> None:
    assert sorted(inspect(repository.engine).get_table_names()) == [
        "profile",
        "profileparent",
        "profilepassword",
        "profilephoto",
    ]


def test_insert_get_update_list_and_names(repository: SqlProfileRepository) -> None:
    seeded = repository.insert(_new("Demo Kid", profile_id=1))
    ada = repository.insert(_new("Ada"))
    assert (seeded.id, ada.id) == (1, 2)
    renamed = repository.update(ada.model_copy(update={"name": "Ada L"}))
    assert repository.get(2) == renamed
    assert [p.name for p in repository.list_all()] == ["Demo Kid", "Ada L"]
    assert repository.names([2, 9]) == {2: "Ada L"}


def test_photos_and_passwords_go_with_the_profile(repository: SqlProfileRepository) -> None:
    profile = repository.insert(_new("Ada", avatar="/static/profile-avatars/a.png"))
    repository.add_photo(profile.id, "/static/profile-avatars/a.png", "Photo", START)
    repository.add_photo(profile.id, "/static/profile-avatars/b.png", "Wizard", START)
    repository.set_password_hash(profile.id, "scrypt$00$11")
    repository.set_password_hash(profile.id, "scrypt$22$33")

    assert [p.label for p in repository.list_photos(profile.id)] == ["Photo", "Wizard"]
    assert repository.owns_photo(profile.id, "/static/profile-avatars/b.png")
    assert not repository.owns_photo(profile.id + 1, "/static/profile-avatars/b.png")
    assert repository.password_hash(profile.id) == "scrypt$22$33"
    assert repository.protected_ids() == frozenset({profile.id})
    assert [p.id for p in repository.with_avatar_prefix("/static/profile-avatars/")] == [profile.id]

    repository.delete(profile.id)
    assert (repository.get(profile.id), repository.list_photos(profile.id)) == (None, ())
    assert repository.password_hash(profile.id) is None


def test_parent_links_move_clear_and_go_with_the_profile(repository: SqlProfileRepository) -> None:
    ada = repository.insert(_new("Ada"))
    bo = repository.insert(_new("Bo"))
    repository.set_parent(ada.id, 10)
    repository.set_parent(ada.id, 11)
    repository.set_parent(bo.id, 11)
    assert repository.parent_links() == {ada.id: 11, bo.id: 11}
    repository.clear_parent(bo.id)
    assert repository.parent_links() == {ada.id: 11}
    repository.set_parent(bo.id, 11)
    repository.clear_parent_links(11)
    assert repository.parent_links() == {}
    repository.set_parent(ada.id, 10)
    repository.delete(ada.id)
    assert repository.parent_links() == {}
