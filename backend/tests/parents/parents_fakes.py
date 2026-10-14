"""Builders for the parents feature: kid histories in a few lines, the games catalog
slice the report reads, and a service over the real repository on tmp_path with fake
neighbors. Local time is UTC (the identity), so days and hours read straight off the
literals."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from itertools import count
from pathlib import Path

from sqlalchemy import create_engine

from app.parents.parents_ports_pure import ParentNeighbors, ParentsService
from app.parents.parents_repository_effect import SqlParentRepository, make_sql_parent_repository
from app.parents.parents_schemas_pure import (
    BadgeEarned,
    GameInfo,
    HistoryAttempt,
    Kid,
    KidHistory,
    LevelChange,
)
from app.parents.parents_service_effect import make_parents_service

NOW = datetime(2026, 10, 14, 18, 0, tzinfo=UTC)
ADMIN_PASSWORD = "admin-secret"


def games() -> Mapping[str, GameInfo]:
    """The slice of the catalog the report reads: a math game, a reading game, a puzzle."""
    return {
        "fact_fluency": GameInfo("fact_fluency", "Equation Outbreak", "🧟", 12, ("arithmetic_fluency",)),
        "syllable_builder": GameInfo("syllable_builder", "Syllable Builder", "🔤", 10, ("phonics",)),
        "pathfinder_no_way_back": GameInfo("pathfinder_no_way_back", "Pathfinder", "🔗", 1, ("spatial_reasoning",)),
    }


def local(moment: datetime) -> datetime:
    return moment


def days_ago(days: int, *, hour: int = 17, minute: int = 0) -> datetime:
    return (NOW - timedelta(days=days)).replace(hour=hour, minute=minute, second=0)


def fact(left: int, operator: str, right: int, answer: int, missing: str = "answer") -> dict[str, object]:
    return {"left": left, "operator": operator, "right": right, "answer": answer, "missing": missing}


def word(target: str, *syllables: str) -> dict[str, object]:
    return {"target_word": target, "correct_syllables": list(syllables), "tiles": list(syllables)}


@dataclass(frozen=True)
class _Outcome:
    game_id: str
    correct: bool | None
    hints: int
    ms: int
    details: Mapping[str, object]


@dataclass
class HistoryBuilder:
    """Appends answers (each with its `item_shown`), level changes, and so on."""

    attempts: list[HistoryAttempt] = field(default_factory=list[HistoryAttempt])
    shown: list[Mapping[str, object]] = field(default_factory=list[Mapping[str, object]])
    actions: list[tuple[datetime, str]] = field(default_factory=list[tuple[datetime, str]])
    changes: list[LevelChange] = field(default_factory=list[LevelChange])
    ratings: list[tuple[str, int]] = field(default_factory=list[tuple[str, int]])
    badges: list[BadgeEarned] = field(default_factory=list[BadgeEarned])
    completions: list[datetime] = field(default_factory=list[datetime])
    ids: "count[int]" = field(default_factory=count)

    def answer(
        self,
        at: datetime,
        payload: Mapping[str, object],
        *,
        game_id: str = "fact_fluency",
        correct: bool | None = True,
        hints: int = 0,
        ms: int = 3000,
    ) -> "HistoryBuilder":
        return self._add(at, payload, _Outcome(game_id=game_id, correct=correct, hints=hints, ms=ms, details={}))

    def wrong_word(self, at: datetime, payload: Mapping[str, object], *assembled: str) -> "HistoryBuilder":
        """A Syllable Builder miss: the tiles the kid put in order instead."""
        outcome = _Outcome(
            game_id="syllable_builder", correct=False, hints=0, ms=3000, details={"assembled": list(assembled)}
        )
        return self._add(at, payload, outcome)

    def _add(self, at: datetime, payload: Mapping[str, object], outcome: "_Outcome") -> "HistoryBuilder":
        game_id, ms = outcome.game_id, outcome.ms
        item_id = f"item-{next(self.ids)}"
        self.shown.append({"item_id": item_id, "game_id": game_id, "level": 1, "payload": dict(payload)})
        self.actions.append((at - timedelta(milliseconds=ms), game_id))
        self.actions.append((at, game_id))
        self.attempts.append(
            HistoryAttempt(
                game_id=game_id,
                item_id=item_id,
                level=1,
                correct=outcome.correct,
                hints_used=outcome.hints,
                time_ms=ms,
                details=outcome.details,
                created_at=at,
            )
        )
        return self

    def answers(
        self,
        start: datetime,
        payloads: Sequence[Mapping[str, object]],
        *,
        game_id: str = "fact_fluency",
        correct: bool = True,
        hints: int = 0,
        ms: int = 3000,
    ) -> "HistoryBuilder":
        """One answer a minute from `start`, every one with the same outcome."""
        for n, payload in enumerate(payloads):
            self.answer(start + timedelta(minutes=n), payload, game_id=game_id, correct=correct, hints=hints, ms=ms)
        return self

    def change(self, at: datetime, before: int, after: int, game_id: str = "fact_fluency") -> "HistoryBuilder":
        self.changes.append(LevelChange(game_id=game_id, at=at, before=before, after=after))
        self.actions.append((at, game_id))
        return self

    def build(self) -> KidHistory:
        return KidHistory(
            attempts=tuple(sorted(self.attempts, key=lambda a: a.created_at)),
            shown_items=tuple(self.shown),
            actions=tuple(sorted(self.actions)),
            level_changes=tuple(sorted(self.changes, key=lambda c: c.at)),
            ratings=tuple(self.ratings),
            badges=tuple(self.badges),
            pathfinder_completions=tuple(sorted(self.completions)),
        )


KID_ID = 7


def kid() -> Kid:
    return Kid(profile_id=KID_ID, name="Rami", avatar="fox", birth_year=2019)


@dataclass
class FakeFamily:
    """Which kids link to which parent, and each kid's history."""

    links: dict[int, int] = field(default_factory=dict[int, int])
    kids: dict[int, Kid] = field(default_factory=lambda: {KID_ID: kid()})
    histories: dict[int, KidHistory] = field(default_factory=dict[int, KidHistory])

    def kids_of(self, parent_id: int) -> tuple[Kid, ...]:
        return tuple(kid for kid_id, kid in sorted(self.kids.items()) if self.links.get(kid_id) == parent_id)

    def history(self, profile_id: int) -> KidHistory:
        return self.histories.get(profile_id) or HistoryBuilder().build()

    def unlink(self, parent_id: int) -> None:
        self.links = {kid: parent for kid, parent in self.links.items() if parent != parent_id}


class PlainHasher:
    """Readable stand-in for scrypt: the service only needs hash/matches to agree."""

    def hash(self, password: str) -> str:
        return f"plain${password}"

    def matches(self, password: str, stored: str) -> bool:
        return stored == f"plain${password}"


@dataclass(frozen=True)
class ParentHarness:
    service: ParentsService
    repository: SqlParentRepository
    family: FakeFamily


def parent_harness(tmp_path: Path) -> ParentHarness:
    repository = make_sql_parent_repository(engine=create_engine(f"sqlite:///{tmp_path / 'parents.db'}"))
    repository.create_schema()
    family = FakeFamily()
    service = make_parents_service(
        repository=repository,
        hasher=PlainHasher(),
        neighbors=ParentNeighbors(
            kids_of=family.kids_of,
            history=family.history,
            unlink_kids=family.unlink,
            games=games(),
            is_admin_password=lambda password: password == ADMIN_PASSWORD,
        ),
        clock=lambda: NOW,
        local_time=local,
    )
    return ParentHarness(service=service, repository=repository, family=family)
