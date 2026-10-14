"""Fakes and builders for badges: an in-memory history the test fills in, a recording
event log, a painter the test can make fail, jobs that run when the test says, and the
real service over the real SQL repository on tmp_path."""

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine

from app.badges.badges_ports_pure import BadgeArt, BadgeNeighbors, BadgesService
from app.badges.badges_repository_effect import SqlBadgeRepository, make_sql_badge_repository
from app.badges.badges_schemas_pure import Activity, ActivityAttempt, BadgeArtImage
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


@dataclass
class FakePainter:
    """Paints a picture naming its prompt, or fails when `failing`."""

    failing: bool = False
    prompts: list[str] = field(default_factory=list[str])

    def __call__(self, prompt: str) -> BadgeArtImage | None:
        self.prompts.append(prompt)
        return None if self.failing else BadgeArtImage(content=prompt.encode(), content_type="image/webp")


@dataclass
class MemoryArtStore:
    saved: list[BadgeArtImage] = field(default_factory=list[BadgeArtImage])

    def save(self, image: BadgeArtImage) -> str:
        self.saved.append(image)
        return f"/static/badge-art/{len(self.saved)}.webp"


@dataclass
class LaterJobs:
    """Jobs queued by `run_later`, run when the test calls `run_all`."""

    queued: list[Callable[[], None]] = field(default_factory=list[Callable[[], None]])

    def run_later(self, job: Callable[[], None]) -> None:
        self.queued.append(job)

    def run_all(self) -> None:
        jobs, self.queued = self.queued, []
        for job in jobs:
            job()


def _title(game_id: str) -> str | None:
    return {"syllable_builder": "Syllable Builder", "zombie_horde": "Zombie Horde"}.get(game_id)


def utc_day(moment: datetime) -> date:
    return moment.date()


@dataclass(frozen=True)
class BadgeHarness:
    service: BadgesService
    repository: SqlBadgeRepository
    history: History
    events: RecordingEvents
    painter: FakePainter
    store: MemoryArtStore
    jobs: LaterJobs


def badge_harness(tmp_path: Path, *, mascot: str | None = "fox") -> BadgeHarness:
    tmp_path.mkdir(parents=True, exist_ok=True)
    repository = make_sql_badge_repository(engine=create_engine(f"sqlite:///{tmp_path / 'badges.db'}"))
    repository.create_schema()
    history = History()
    events = RecordingEvents()
    painter, store, jobs = FakePainter(), MemoryArtStore(), LaterJobs()
    service = make_badges_service(
        repository=repository,
        events=events,
        neighbors=BadgeNeighbors(
            activity=history.activity,
            profile_exists=lambda profile_id: profile_id == 1,
            game_title=_title,
            mascot=lambda _profile_id: mascot,
        ),
        art=BadgeArt(paint=painter, store=store, run_later=jobs.run_later),
        clock=lambda: NOW,
        local_day=utc_day,
    )
    service.seed()
    return BadgeHarness(
        service=service,
        repository=repository,
        history=history,
        events=events,
        painter=painter,
        store=store,
        jobs=jobs,
    )
