"""SQL storage for badges and awards over an injected engine. The tables keep the names
and columns the app has always used (`badge`, `badgeaward`), so existing databases work
unchanged; what came later about an award (its art, its celebration) lives in a table of
its own, `badgeawarddetail`, which `create_schema` adds to an existing database."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    delete,
    insert,
    select,
    update,
)

from app.badges.badges_reducers_pure import art_url, criteria_json
from app.badges.badges_schemas_pure import AwardDetail, Badge, BadgeAward, SeedBadge


@dataclass(frozen=True)
class SqlBadgeRepository:
    engine: Engine
    badge_table: Table
    award_table: Table
    detail_table: Table
    metadata: MetaData

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

    def badges(self) -> tuple[Badge, ...]:
        with self.engine.connect() as connection:
            rows = connection.execute(select(self.badge_table).order_by(self.badge_table.c.id)).mappings().all()
        return tuple(Badge.model_validate(dict(row)) for row in rows)

    def sync(self, seeds: Sequence[SeedBadge]) -> None:
        existing = {badge.key for badge in self.badges()}
        rows = [
            {
                "key": seed.key,
                "name": seed.name,
                "description": seed.description,
                "art_url": art_url(seed.key),
                "criteria": criteria_json(seed.criteria),
            }
            for seed in seeds
        ]
        with self.engine.begin() as connection:
            new_rows = [row for row in rows if row["key"] not in existing]
            if new_rows:
                connection.execute(insert(self.badge_table), new_rows)
            for row in rows:
                if row["key"] in existing:
                    connection.execute(
                        update(self.badge_table).where(self.badge_table.c.key == row["key"]).values(**row)
                    )

    def awards(self, profile_id: int) -> Mapping[int, BadgeAward]:
        query = select(self.award_table).where(self.award_table.c.profile_id == profile_id)
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return {int(row["badge_id"]): BadgeAward.model_validate(dict(row)) for row in rows}

    def award(self, profile_id: int, badge_id: int, session_id: str | None, awarded_at: datetime) -> None:
        values = {"profile_id": profile_id, "badge_id": badge_id, "session_id": session_id, "awarded_at": awarded_at}
        with self.engine.begin() as connection:
            connection.execute(insert(self.award_table).values(**values))

    def details(self, profile_id: int) -> Mapping[int, AwardDetail]:
        query = select(self.detail_table).where(self.detail_table.c.profile_id == profile_id)
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return {int(row["badge_id"]): AwardDetail.model_validate(dict(row)) for row in rows}

    def save_detail(self, profile_id: int, detail: AwardDetail) -> None:
        c = self.detail_table.c
        with self.engine.begin() as connection:
            connection.execute(
                delete(self.detail_table).where(c.profile_id == profile_id, c.badge_id == detail.badge_id)
            )
            connection.execute(insert(self.detail_table).values(profile_id=profile_id, **detail.model_dump()))

    def delete_for_profile(self, profile_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.detail_table).where(self.detail_table.c.profile_id == profile_id))
            connection.execute(delete(self.award_table).where(self.award_table.c.profile_id == profile_id))


def make_sql_badge_repository(*, engine: Engine) -> SqlBadgeRepository:
    metadata = MetaData()
    badge_table = Table(
        "badge",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("key", String, nullable=False, unique=True, index=True),
        Column("name", String, nullable=False),
        Column("description", String, nullable=False),
        Column("art_url", String, nullable=False),
        Column("criteria", JSON),
    )
    award_table = Table(
        "badgeaward",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("profile_id", Integer, nullable=False),
        Column("badge_id", Integer, ForeignKey("badge.id"), nullable=False),
        Column("session_id", String),
        Column("awarded_at", DateTime, nullable=False),
        UniqueConstraint("profile_id", "badge_id"),
    )
    detail_table = Table(
        "badgeawarddetail",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("profile_id", Integer, nullable=False),
        Column("badge_id", Integer, ForeignKey("badge.id"), nullable=False),
        Column("art_status", String, nullable=False),
        Column("art_url", String),
        Column("celebrated", Boolean, nullable=False),
        UniqueConstraint("profile_id", "badge_id"),
    )
    return SqlBadgeRepository(
        engine=engine, badge_table=badge_table, award_table=award_table, detail_table=detail_table, metadata=metadata
    )
