"""Builders for the event log under test: the real log on tmp_path with a ticking clock
and sequential ids."""

from datetime import UTC, datetime, timedelta
from itertools import count
from pathlib import Path

from sqlalchemy import create_engine

from app.events.events_repository_effect import SqlEventLog, make_sql_event_log

START = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)


class TickingClock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        reading = self.now
        self.now += timedelta(seconds=1)
        return reading


def event_log(tmp_path: Path) -> SqlEventLog:
    ids = (f"event-{n}" for n in count(1))
    log = make_sql_event_log(
        engine=create_engine(f"sqlite:///{tmp_path / 'events.db'}"), clock=TickingClock(), new_id=lambda: next(ids)
    )
    log.create_schema()
    return log
