"""Fakes and builders for badges: an in-memory history the test fills in, a recording
event log, and the real service over the real SQL repository on tmp_path."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine

from app.badges.badges_ports_pure import BadgeNeighbors, BadgesService
from app.badges.badges_repository_effect import SqlBadgeRepository, make_sql_badge_repository
from app.badges.badges_schemas_pure import Activity, ActivityAttempt
from app.badges.badges_service_effect import make_badges_service

NOW = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)  # a Wednesday


@dataclass
class History:
    attempts: list[ActivityAttempt] = field(default_factory=list[ActivityAttempt])
    pieces: list[str] = field(default_factory=list[str])
    ratings: list[int] = field(default_factory=list[int])
    events: list[datetime] = field(default_factory=list[datetime])

    def attempt(
        self, *, game_id: str = "syllable_builder", correct: bool | None = True, time_ms: int = 5000, days_ago: int = 0
    ) -> None:
        when = NOW - timedelta(days=days_ago)
        self.attempts.append(ActivityAttempt(game_id=game_id, correct=correct, time_ms=time_ms, created_at=when))

    def activity(self, _profile_id: int) -> Activity:
        return Activity(
            attempts=tuple(self.attempts),
            piece_game_ids=tuple(self.pieces),
            rating_values=tuple(self.ratings),
            event_timestamps=tuple(self.events),
        )


@dataclass
class RecordingEvents:
    appended: list[tuple[str, dict[str, object]]] = field(default_factory=list[tuple[str, dict[str, object]]])

    def append(
        self,
        *,
        profile_id: int,
        game_id: str,
        event_type: str,
        payload: Mapping[str, object],
        variant_id: str | None,
        session_id: str | None,
    ) -> str:
        self.appended.append((event_type, dict(payload)))
        return f"event-{len(self.appended)}"


def _title(game_id: str) -> str | None:
    return "Syllable Builder" if game_id == "syllable_builder" else None


@dataclass(frozen=True)
class BadgeHarness:
    service: BadgesService
    repository: SqlBadgeRepository
    history: History
    events: RecordingEvents


def badge_harness(tmp_path: Path) -> BadgeHarness:
    tmp_path.mkdir(parents=True, exist_ok=True)
    repository = make_sql_badge_repository(engine=create_engine(f"sqlite:///{tmp_path / 'badges.db'}"))
    repository.create_schema()
    history = History()
    events = RecordingEvents()
    service = make_badges_service(
        repository=repository,
        events=events,
        neighbors=BadgeNeighbors(
            activity=history.activity,
            profile_exists=lambda profile_id: profile_id == 1,
            game_title=_title,
        ),
        clock=lambda: NOW,
    )
    service.seed()
    return BadgeHarness(service=service, repository=repository, history=history, events=events)
