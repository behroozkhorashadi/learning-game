import pytest
from pydantic import ValidationError

from app.badges.badges_schemas_pure import AwardDetail, BadgeCriteria, ProfileStats


def test_criteria_parse_the_stored_json_with_defaults() -> None:
    criteria = BadgeCriteria.model_validate({"type": "fast_correct_attempts", "count": 5, "max_time_ms": 4000})
    assert (criteria.count, criteria.max_time_ms, criteria.game_id) == (5, 4000, None)
    assert BadgeCriteria.model_validate({"type": "something_new"}).count == 0


def test_stats_optional_fields_default_to_none() -> None:
    stats = ProfileStats(
        total_stars=0, day_streak=0, minutes_this_week=0, longest_streak=0, total_minutes=0, recent_days=()
    )
    assert (stats.most_played_game, stats.avg_rating, stats.progress_delta_pct) == (None, None, None)


def test_award_details_parse_stored_rows_and_reject_unknown_art_states() -> None:
    row = {"badge_id": 3, "art_status": "ready", "art_url": "/static/badge-art/x.webp", "celebrated": True}
    assert AwardDetail.model_validate(row).art_url == "/static/badge-art/x.webp"
    with pytest.raises(ValidationError):
        AwardDetail.model_validate({**row, "art_status": "sparkly"})
