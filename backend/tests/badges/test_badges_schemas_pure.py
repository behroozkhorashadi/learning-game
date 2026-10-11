from app.badges.badges_schemas_pure import BadgeCriteria, ProfileStats


def test_criteria_parse_the_stored_json_with_defaults() -> None:
    criteria = BadgeCriteria.model_validate({"type": "fast_correct_attempts", "count": 5, "max_time_ms": 4000})
    assert (criteria.count, criteria.max_time_ms, criteria.game_id) == (5, 4000, None)
    assert BadgeCriteria.model_validate({"type": "something_new"}).count == 0


def test_stats_optional_fields_default_to_none() -> None:
    stats = ProfileStats(total_stars=0, day_streak=0, minutes_this_week=0)
    assert (stats.most_played_game, stats.avg_rating, stats.progress_delta_pct) == (None, None, None)
