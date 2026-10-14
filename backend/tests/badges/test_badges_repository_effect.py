from pathlib import Path

from sqlalchemy import inspect, text

from app.badges.badges_reducers_pure import SEED_BADGES
from app.badges.badges_schemas_pure import AwardDetail
from tests.badges.badges_fakes import NOW, badge_harness


def test_keeps_the_existing_tables_and_criteria_json(tmp_path: Path) -> None:
    repository = badge_harness(tmp_path).repository
    inspector = inspect(repository.engine)
    assert sorted(inspector.get_table_names()) == ["badge", "badgeaward", "badgeawarddetail"]
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


def test_syncing_seeds_updates_stored_badges_and_keeps_their_ids(tmp_path: Path) -> None:
    repository = badge_harness(tmp_path).repository
    with repository.engine.begin() as connection:
        connection.execute(text("UPDATE badge SET name = 'Old Name', description = 'old' WHERE key = 'speed-demon'"))
    ids = {badge.key: badge.id for badge in repository.badges()}
    repository.sync(SEED_BADGES)
    after = {badge.key: badge for badge in repository.badges()}
    assert {key: badge.id for key, badge in after.items()} == ids
    assert (after["speed-demon"].name, after["speed-demon"].description) == ("Speed Demon", "Play 50 rounds")


def test_award_details_are_saved_replaced_and_go_with_the_profile(tmp_path: Path) -> None:
    repository = badge_harness(tmp_path).repository
    repository.award(1, 1, None, NOW)
    repository.save_detail(1, AwardDetail(badge_id=1, art_status="pending", celebrated=False))
    repository.save_detail(1, AwardDetail(badge_id=1, art_status="ready", art_url="/a.webp", celebrated=False))
    repository.save_detail(2, AwardDetail(badge_id=1, art_status="failed", celebrated=True))
    ready = AwardDetail(badge_id=1, art_status="ready", art_url="/a.webp", celebrated=False)
    assert repository.details(1) == {1: ready}
    repository.delete_for_profile(1)
    assert repository.details(1) == {}
    assert list(repository.details(2)) == [1]
