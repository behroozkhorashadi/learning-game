"""The event log over an injected engine, clock, and id factory. The `event` table keeps
the name and columns the app has always used (event types stored by enum *name*), so
existing databases work unchanged. Appending is the only write besides deleting a
profile's history: events are never mutated after insert.

Methods take and return plain values (strings, mappings) so other features can declare
the slice they use as their own Protocol without importing this feature."""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Engine, Integer, MetaData, Select, String, Table, delete, insert, select
from sqlalchemy import Enum as SqlEnum

from app.events.events_schemas_pure import Event, EventType


@dataclass(frozen=True)
class SqlEventLog:
    engine: Engine
    table: Table
    metadata: MetaData
    clock: Callable[[], datetime]
    new_id: Callable[[], str]

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

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
        """Validates the event (an unknown type is a ValueError) and returns its id."""
        event = Event(
            event_id=self.new_id(),
            timestamp=self.clock(),
            profile_id=profile_id,
            game_id=game_id,
            variant_id=variant_id,
            session_id=session_id,
            event_type=EventType(event_type),
            payload=dict(payload),
        )
        with self.engine.begin() as connection:
            connection.execute(insert(self.table).values(**event.model_dump()))
        return event.event_id

    def payloads(
        self, *, profile_id: int, game_id: str, session_id: str, event_type: str
    ) -> tuple[dict[str, object], ...]:
        c = self.table.c
        query = select(self.table).where(
            c.profile_id == profile_id,
            c.game_id == game_id,
            c.session_id == session_id,
            c.event_type == EventType(event_type),
        )
        return tuple(event.payload for event in self._events(query))

    def recent_payloads(
        self, *, profile_id: int, game_id: str, event_type: str, limit: int
    ) -> tuple[dict[str, object], ...]:
        c = self.table.c
        query = (
            select(self.table)
            .where(
                c.profile_id == profile_id,
                c.game_id == game_id,
                c.event_type == EventType(event_type),
            )
            .order_by(c.timestamp.desc())
            .limit(limit)
        )
        return tuple(event.payload for event in reversed(self._events(query)))

    def latest(
        self, *, profile_id: int, game_id: str, event_types: Sequence[str]
    ) -> tuple[str, dict[str, object]] | None:
        c = self.table.c
        query = (
            select(self.table)
            .where(
                c.profile_id == profile_id, c.game_id == game_id, c.event_type.in_([EventType(t) for t in event_types])
            )
            .order_by(c.timestamp.desc())
            .limit(1)
        )
        found = self._events(query)
        return None if not found else (found[0].event_type.value, found[0].payload)

    def timestamps(self, profile_id: int) -> tuple[datetime, ...]:
        query = select(self.table.c.timestamp).where(self.table.c.profile_id == profile_id)
        with self.engine.connect() as connection:
            return tuple(connection.execute(query).scalars())

    def for_profile(self, profile_id: int, event_types: Sequence[str]) -> tuple[Event, ...]:
        """A profile's events of these types, oldest first."""
        c = self.table.c
        query = (
            select(self.table)
            .where(c.profile_id == profile_id, c.event_type.in_([EventType(t) for t in event_types]))
            .order_by(c.timestamp)
        )
        return self._events(query)

    def delete_for_profile(self, profile_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.table).where(self.table.c.profile_id == profile_id))

    def _events(self, query: Select[Any]) -> tuple[Event, ...]:
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return tuple(Event.model_validate(dict(row)) for row in rows)


def make_sql_event_log(*, engine: Engine, clock: Callable[[], datetime], new_id: Callable[[], str]) -> SqlEventLog:
    metadata = MetaData()
    table = Table(
        "event",
        metadata,
        Column("event_id", String, primary_key=True),
        Column("timestamp", DateTime, nullable=False),
        Column("profile_id", Integer, nullable=False),
        Column("game_id", String, nullable=False),
        Column("variant_id", String),
        Column("session_id", String),
        Column("event_type", SqlEnum(EventType), nullable=False),
        Column("payload", JSON),
    )
    return SqlEventLog(engine=engine, table=table, metadata=metadata, clock=clock, new_id=new_id)
