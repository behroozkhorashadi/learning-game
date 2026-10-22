from datetime import UTC, datetime

from sqlalchemy import create_engine

from app.engagement.engagement_repository_effect import make_sql_engagement_repository
from app.engagement.engagement_schemas_pure import EngagementSpan


def test_repository_aggregates_by_area_and_deletes_profile_rows() -> None:
    repository = make_sql_engagement_repository(engine=create_engine("sqlite://"))
    repository.create_schema()
    at = datetime(2026, 1, 2, tzinfo=UTC)
    repository.add(
        (
            EngagementSpan(area="home", active_ms=1000, profile_id=None),
            EngagementSpan(area="game:zombie_horde", active_ms=5000, profile_id=2),
            EngagementSpan(area="game:zombie_horde", active_ms=3000, profile_id=2),
        ),
        at,
    )

    assert [(row.area, row.active_ms) for row in repository.summary()] == [
        ("game:zombie_horde", 8000),
        ("home", 1000),
    ]
    repository.delete_for_profile(2)
    assert [(row.area, row.active_ms) for row in repository.summary()] == [("home", 1000)]
