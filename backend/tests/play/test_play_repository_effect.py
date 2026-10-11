from datetime import timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

from app.play.play_repository_effect import SqlPlayRepository, make_sql_play_repository
from app.play.play_schemas_pure import Attempt, Level, Rating, RatingScale, Verification
from tests.play.play_fakes import START


@pytest.fixture
def repository(tmp_path: Path) -> SqlPlayRepository:
    repo = make_sql_play_repository(engine=create_engine(f"sqlite:///{tmp_path / 'play.db'}"))
    repo.create_schema()
    return repo


def _attempt(*, level: int = 1, minutes: int = 0, profile_id: int = 1) -> Attempt:
    return Attempt(
        item_id="i",
        profile_id=profile_id,
        game_id="g",
        level=level,
        correct=True,
        hints_used=0,
        time_ms=500,
        details={"tiles": ["a"]},
        created_at=START + timedelta(minutes=minutes),
    )


def test_keeps_the_existing_tables(repository: SqlPlayRepository) -> None:
    assert sorted(inspect(repository.engine).get_table_names()) == [
        "attempt",
        "level",
        "playsession",
        "rating",
        "skill",
        "skillstate",
        "variant",
        "verification",
    ]


def test_levels_are_created_then_updated_in_place(repository: SqlPlayRepository) -> None:
    created = repository.save_level(Level(profile_id=1, game_id="g", value=2, updated_at=START))
    updated = repository.save_level(created.model_copy(update={"value": 3}))
    assert (created.id, updated.id, updated.value) == (1, 1, 3)
    assert repository.get_level(1, "g") == updated
    assert repository.get_level(1, "other") is None


def test_the_window_is_recent_attempts_at_the_level_since_it_was_set(repository: SqlPlayRepository) -> None:
    level = Level(id=1, profile_id=1, game_id="g", value=1, updated_at=START + timedelta(minutes=1))
    repository.add_attempt(_attempt(minutes=0))  # before the level was last set
    repository.add_attempt(_attempt(minutes=2, level=2))  # another level
    repository.add_attempt(_attempt(minutes=3, profile_id=2))  # another kid
    first = repository.add_attempt(_attempt(minutes=4))
    second = repository.add_attempt(_attempt(minutes=5))
    third = repository.add_attempt(_attempt(minutes=6))
    assert repository.recent_attempts_at_level(level, limit=2) == (second, third)
    assert repository.recent_attempts_at_level(level, limit=5) == (first, second, third)
    assert first.details == {"tiles": ["a"]}


def test_ratings_store_the_scale_by_name_as_before(repository: SqlPlayRepository) -> None:
    rating = repository.add_rating(
        Rating(profile_id=1, game_id="g", scale=RatingScale.STARS_1_5, value=4, created_at=START)
    )
    assert (rating.id, rating.scale) == (1, RatingScale.STARS_1_5)
    with repository.engine.connect() as connection:
        assert connection.execute(text("SELECT scale FROM rating")).scalar_one() == "STARS_1_5"


def test_delete_for_profile_takes_verifications_of_its_attempts(repository: SqlPlayRepository) -> None:
    mine = repository.add_attempt(_attempt())
    theirs = repository.add_attempt(_attempt(profile_id=2))
    assert mine.id is not None
    assert theirs.id is not None
    repository.add_verification(Verification(attempt_id=mine.id, correct=True, verified_at=START))
    kept = repository.add_verification(Verification(attempt_id=theirs.id, correct=False, verified_at=START))
    repository.save_level(Level(profile_id=1, game_id="g", value=2, updated_at=START))

    repository.delete_for_profile(1)

    assert repository.get_attempt(mine.id) is None
    assert repository.get_attempt(theirs.id) is not None
    assert repository.get_level(1, "g") is None
    with repository.engine.connect() as connection:
        assert connection.execute(text("SELECT id FROM verification")).scalars().all() == [kept.id]
