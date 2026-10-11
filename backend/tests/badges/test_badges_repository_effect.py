from pathlib import Path

from sqlalchemy import inspect, text

from tests.badges.badges_fakes import NOW, badge_harness


def test_keeps_the_existing_tables_and_criteria_json(tmp_path: Path) -> None:
    repository = badge_harness(tmp_path).repository
    inspector = inspect(repository.engine)
    assert sorted(inspector.get_table_names()) == ["badge", "badgeaward"]
    assert [ix["name"] for ix in inspector.get_indexes("badge")] == ["ix_badge_key"]
    with repository.engine.connect() as connection:
        stored = connection.execute(text("SELECT criteria FROM badge WHERE key = 'sound-master'")).scalar_one()
    assert stored == '{"type": "attempts_correct", "count": 20, "game_id": "syllable_builder"}'


def test_awards_are_per_profile_and_go_with_it(tmp_path: Path) -> None:
    repository = badge_harness(tmp_path).repository
    repository.award(1, 1, "s1", NOW)
    repository.award(2, 1, None, NOW)
    assert list(repository.awards(1)) == [1]
    repository.delete_for_profile(1)
    assert repository.awards(1) == {}
    assert list(repository.awards(2)) == [1]
