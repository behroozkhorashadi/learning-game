"""SQL storage for round recordings over an injected engine. The recording is kept
as JSON text and parsed back through the schemas at the boundary."""

import json
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import Column, Engine, Integer, MetaData, String, Table, Text, delete, insert, select

from app.replays.replays_schemas_pure import Replay, ReplayCreate, ReplaySummary

_SUMMARY_COLUMNS = ("id", "profile_id", "created_at", "outcome", "duration_ms", "flags", "size_bytes")


@dataclass(frozen=True)
class SqlReplayRepository:
    engine: Engine
    table: Table
    metadata: MetaData

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

    def add(self, summary: ReplaySummary, recording: ReplayCreate) -> None:
        row = {**summary.model_dump(exclude={"created_at"}), "created_at": summary.created_at.isoformat()}
        with self.engine.begin() as connection:
            connection.execute(
                insert(self.table).values(**row, data=json.dumps(recording.recording, separators=(",", ":")))
            )

    def summaries_for(self, profile_id: int) -> tuple[ReplaySummary, ...]:
        columns = [self.table.c[name] for name in _SUMMARY_COLUMNS]
        query = select(*columns).where(self.table.c.profile_id == profile_id).order_by(self.table.c.created_at.desc())
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return tuple(ReplaySummary.model_validate(dict(row)) for row in rows)

    def get(self, replay_id: str) -> Replay | None:
        with self.engine.connect() as connection:
            row = connection.execute(select(self.table).where(self.table.c.id == replay_id)).mappings().first()
        if row is None:
            return None
        summary = {name: row[name] for name in _SUMMARY_COLUMNS}
        return Replay.model_validate({"summary": summary, "recording": json.loads(str(row["data"]))})

    def delete(self, replay_ids: Sequence[str]) -> None:
        if not replay_ids:
            return
        with self.engine.begin() as connection:
            connection.execute(delete(self.table).where(self.table.c.id.in_(list(replay_ids))))

    def delete_for_profile(self, profile_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.table).where(self.table.c.profile_id == profile_id))


def make_sql_replay_repository(*, engine: Engine) -> SqlReplayRepository:
    metadata = MetaData()
    table = Table(
        "horde_replays",
        metadata,
        Column("id", String(64), primary_key=True),
        Column("profile_id", Integer, nullable=False, index=True),
        # ISO-8601 text keeps the UTC offset, which SQLite's DATETIME drops.
        Column("created_at", String(40), nullable=False),
        Column("outcome", String(16), nullable=False),
        Column("duration_ms", Integer, nullable=False),
        Column("flags", Integer, nullable=False),
        Column("size_bytes", Integer, nullable=False),
        Column("data", Text, nullable=False),
    )
    return SqlReplayRepository(engine=engine, table=table, metadata=metadata)
