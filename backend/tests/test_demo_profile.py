from sqlmodel import Session, SQLModel, create_engine, select

from app.main import _remove_demo_profile_if_needed, _seed_test_profiles, features
from app.models.profile import Profile


def _session() -> Session:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    # Migrated features' tables hang off profiles too.
    features.practice_configs.metadata.create_all(engine)
    features.pathfinder.metadata.create_all(engine)
    return Session(engine)


def test_seed_adds_demo_to_empty_database():
    with _session() as session:
        _seed_test_profiles(session)

        profiles = session.exec(select(Profile)).all()
        assert [(profile.id, profile.name) for profile in profiles] == [(1, "Demo Kid")]


def test_seed_does_not_add_demo_when_real_profile_exists():
    with _session() as session:
        session.add(Profile(name="Real Kid", avatar="owl", birth_year=2019))
        session.commit()

        _seed_test_profiles(session)

        assert [profile.name for profile in session.exec(select(Profile)).all()] == ["Real Kid"]


def test_demo_is_removed_once_another_profile_exists():
    with _session() as session:
        _seed_test_profiles(session)
        session.add(Profile(name="Real Kid", avatar="owl", birth_year=2019))
        session.flush()

        _remove_demo_profile_if_needed(session)
        session.commit()

        assert [profile.name for profile in session.exec(select(Profile)).all()] == ["Real Kid"]


def test_non_demo_profile_with_reserved_id_is_not_removed():
    with _session() as session:
        session.add(Profile(id=1, name="Real Kid", avatar="owl", birth_year=2019))
        session.add(Profile(id=2, name="Another Kid", avatar="fox", birth_year=2020))
        session.commit()

        _remove_demo_profile_if_needed(session)
        session.commit()

        assert [profile.name for profile in session.exec(select(Profile)).all()] == ["Real Kid", "Another Kid"]
