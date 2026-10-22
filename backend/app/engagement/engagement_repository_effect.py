"""Aggregated active-time spans stored in SQLite; no raw interaction events are kept."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Column, DateTime, Engine, Integer, MetaData, String, Table, delete, func, insert, select

from app.engagement.engagement_schemas_pure import EngagementSpan, EngagementSummary


@dataclass(frozen=True)
class SqlEngagementRepository:
    engine: Engine
    table: Table
    metadata: MetaData

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

    def add(self, spans: Sequence[EngagementSpan], recorded_at: datetime) -> None:
        rows = [
            {
                "recorded_at": recorded_at,
                "profile_id": span.profile_id,
                "area": span.area,
                "active_ms": span.active_ms,
            }
            for span in spans
        ]
        if not rows:
            return
        with self.engine.begin() as connection:
            connection.execute(insert(self.table), rows)

    def summary(self) -> tuple[EngagementSummary, ...]:
        active_ms = func.sum(self.table.c.active_ms).label("active_ms")
        query = select(self.table.c.area, active_ms).group_by(self.table.c.area).order_by(active_ms.desc())
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return tuple(EngagementSummary.model_validate(dict(row)) for row in rows)

    def delete_for_profile(self, profile_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.table).where(self.table.c.profile_id == profile_id))


def make_sql_engagement_repository(*, engine: Engine) -> SqlEngagementRepository:
    metadata = MetaData()
    table = Table(
        "engagement_spans",
        metadata,
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column("recorded_at", DateTime, nullable=False),
        Column("profile_id", Integer, nullable=True, index=True),
        Column("area", String(100), nullable=False, index=True),
        Column("active_ms", Integer, nullable=False),
    )
    return SqlEngagementRepository(engine=engine, table=table, metadata=metadata)
