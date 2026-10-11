"""Fakes for the play feature: a seeded random source (the stdlib `random` module is
banned outside assembly, so tests bring their own), a ticking clock, and a harness that
builds the real service over the real SQL repository and event log on tmp_path, with
the other features (profiles, practice, badges) faked."""

from collections.abc import Mapping, MutableSequence, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from itertools import count
from pathlib import Path

from pydantic import TypeAdapter
from sqlalchemy import create_engine, select

from app.events.events_repository_effect import SqlEventLog, make_sql_event_log
from app.events.events_schemas_pure import Event, EventType
from app.play.games.catalog_reducers_pure import game_catalog
from app.play.play_ports_pure import PlayNeighbors, PlayService
from app.play.play_repository_effect import SqlPlayRepository, make_sql_play_repository
from app.play.play_schemas_pure import Level, PracticeSettings
from app.play.play_service_effect import make_play_service

START = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)
YEAR = START.year
_MASK64 = (1 << 64) - 1


class SeededRng:
    """A small splitmix64 generator with the slice of `random.Random`'s API the games use.
    Same seed, same sequence."""

    def __init__(self, seed: int) -> None:
        self._state = seed & _MASK64

    def _next(self) -> int:
        self._state = (self._state + 0x9E3779B97F4A7C15) & _MASK64
        z = self._state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & _MASK64
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & _MASK64
        return z ^ (z >> 31)

    def _below(self, n: int) -> int:
        if n <= 0:
            msg = "empty range"
            raise ValueError(msg)
        bits = n.bit_length()
        while True:
            value = self._next() >> (64 - bits)
            if value < n:
                return value

    def random(self) -> float:
        return (self._next() >> 11) / (1 << 53)

    def getrandbits(self, k: int, /) -> int:
        return self._next() >> (64 - k)

    def randint(self, a: int, b: int, /) -> int:
        return a + self._below(b - a + 1)

    def choice[T](self, seq: Sequence[T], /) -> T:
        return seq[self._below(len(seq))]

    def shuffle[T](self, x: MutableSequence[T], /) -> None:
        for i in range(len(x) - 1, 0, -1):
            j = self._below(i + 1)
            x[i], x[j] = x[j], x[i]

    def sample[T](self, population: Sequence[T], k: int, /) -> list[T]:
        pool = list(population)
        for i in range(k):
            j = i + self._below(len(pool) - i)
            pool[i], pool[j] = pool[j], pool[i]
        return pool[:k]


class TickingClock:
    """Each reading is one millisecond after the last, so "newest" is well defined."""

    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        reading = self.now
        self.now += timedelta(milliseconds=1)
        return reading


@dataclass
class PlayHarness:
    service: PlayService
    repository: SqlPlayRepository
    events: SqlEventLog
    birth_years: dict[int, int]
    practice: dict[tuple[int, str], PracticeSettings]
    attempts_reported: list[tuple[int, str | None]] = field(default_factory=list[tuple[int, str | None]])

    def level(self, profile_id: int, game_id: str) -> Level | None:
        return self.repository.get_level(profile_id, game_id)

    def events_of(self, profile_id: int, event_type: EventType) -> list[Event]:
        table = self.events.table
        query = (
            select(table)
            .where(table.c.profile_id == profile_id, table.c.event_type == event_type)
            .order_by(table.c.timestamp)
        )
        with self.events.engine.connect() as connection:
            return [Event.model_validate(dict(row)) for row in connection.execute(query).mappings()]


def play_harness(tmp_path: Path, *, birth_years: Mapping[int, int] | None = None) -> PlayHarness:
    """Profile 1 is 6 years old unless `birth_years` says otherwise."""
    engine = create_engine(f"sqlite:///{tmp_path / 'play.db'}")
    clock = TickingClock()
    ids = (f"event-{n}" for n in count(1))
    seeds = count(1)
    repository = make_sql_play_repository(engine=engine)
    repository.create_schema()
    events = make_sql_event_log(engine=engine, clock=clock, new_id=lambda: next(ids))
    events.create_schema()
    years = dict(birth_years) if birth_years is not None else {1: YEAR - 6}
    practice: dict[tuple[int, str], PracticeSettings] = {}
    reported: list[tuple[int, str | None]] = []
    service = make_play_service(
        repository=repository,
        events=events,
        games=game_catalog(),
        neighbors=PlayNeighbors(
            birth_year=years.get,
            practice_settings=lambda profile_id, game_id: practice.get((profile_id, game_id)),
            after_attempt=lambda profile_id, session_id: reported.append((profile_id, session_id)),
        ),
        clock=clock,
        new_rng=lambda: SeededRng(next(seeds)),
    )
    return PlayHarness(
        service=service,
        repository=repository,
        events=events,
        birth_years=years,
        practice=practice,
        attempts_reported=reported,
    )


def int_at(payload: Mapping[str, object], key: str) -> int:
    value = payload[key]
    assert isinstance(value, int)
    return value


def str_at(payload: Mapping[str, object], key: str) -> str:
    value = payload[key]
    assert isinstance(value, str)
    return value


def list_at(payload: Mapping[str, object], key: str) -> list[object]:
    return TypeAdapter(list[object]).validate_python(payload[key])
