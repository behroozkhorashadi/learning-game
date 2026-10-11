"""SQL storage for play over an injected engine: levels, attempts, ratings, and
verifications, plus the inert tables that came with them (sessions, skills, skill
states, variants). Every table keeps the name and columns the app has always used, so
existing databases work unchanged. Rows are parsed back through the schemas."""

from dataclasses import dataclass

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Engine,
    Float,
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
from sqlalchemy import Enum as SqlEnum

from app.play.play_schemas_pure import Attempt, Level, Rating, RatingScale, Verification


@dataclass(frozen=True)
class SqlPlayRepository:
    engine: Engine
    levels: Table
    attempts: Table
    ratings: Table
    verifications: Table
    sessions: Table
    skill_states: Table
    skills: Table
    variants: Table
    metadata: MetaData

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

    def get_level(self, profile_id: int, game_id: str) -> Level | None:
        query = select(self.levels).where(self.levels.c.profile_id == profile_id, self.levels.c.game_id == game_id)
        with self.engine.connect() as connection:
            row = connection.execute(query).mappings().first()
        return None if row is None else Level.model_validate(dict(row))

    def save_level(self, level: Level) -> Level:
        values = level.model_dump(exclude={"id"})
        with self.engine.begin() as connection:
            if level.id is None:
                connection.execute(insert(self.levels).values(**values))
            else:
                connection.execute(update(self.levels).where(self.levels.c.id == level.id).values(**values))
        stored = self.get_level(level.profile_id, level.game_id)
        if stored is None:
            msg = f"level for {level.profile_id}/{level.game_id} vanished after saving"
            raise LookupError(msg)
        return stored

    def add_attempt(self, attempt: Attempt) -> Attempt:
        with self.engine.begin() as connection:
            statement = insert(self.attempts).values(**attempt.model_dump(exclude={"id"})).returning(self.attempts.c.id)
            attempt_id = int(connection.execute(statement).scalar_one())
        stored = self.get_attempt(attempt_id)
        if stored is None:
            msg = f"attempt {attempt_id} vanished after insert"
            raise LookupError(msg)
        return stored

    def get_attempt(self, attempt_id: int) -> Attempt | None:
        with self.engine.connect() as connection:
            row = connection.execute(select(self.attempts).where(self.attempts.c.id == attempt_id)).mappings().first()
        return None if row is None else Attempt.model_validate(dict(row))

    def recent_attempts_at_level(self, level: Level, limit: int) -> tuple[Attempt, ...]:
        """Querying attempts at the current level made since it was last set *is* the
        mastery-window reset: earlier visits to the same level number are excluded."""
        c = self.attempts.c
        query = (
            select(self.attempts)
            .where(
                c.profile_id == level.profile_id,
                c.game_id == level.game_id,
                c.level == level.value,
                c.created_at >= level.updated_at,
            )
            .order_by(c.created_at.desc(), c.id.desc())
            .limit(limit)
        )
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return tuple(Attempt.model_validate(dict(row)) for row in reversed(rows))

    def attempts_for_profile(self, profile_id: int) -> tuple[Attempt, ...]:
        """Oldest first."""
        c = self.attempts.c
        query = select(self.attempts).where(c.profile_id == profile_id).order_by(c.created_at, c.id)
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return tuple(Attempt.model_validate(dict(row)) for row in rows)

    def rating_values(self, profile_id: int) -> tuple[int, ...]:
        query = select(self.ratings.c.value).where(self.ratings.c.profile_id == profile_id)
        with self.engine.connect() as connection:
            return tuple(int(value) for value in connection.execute(query).scalars())

    def add_rating(self, rating: Rating) -> Rating:
        with self.engine.begin() as connection:
            statement = insert(self.ratings).values(**rating.model_dump(exclude={"id"})).returning(self.ratings.c.id)
            rating_id = connection.execute(statement).scalar_one()
            row = connection.execute(select(self.ratings).where(self.ratings.c.id == rating_id)).mappings().one()
        return Rating.model_validate(dict(row))

    def add_verification(self, verification: Verification) -> Verification:
        table = self.verifications
        with self.engine.begin() as connection:
            statement = insert(table).values(**verification.model_dump(exclude={"id"})).returning(table.c.id)
            verification_id = connection.execute(statement).scalar_one()
            row = connection.execute(select(table).where(table.c.id == verification_id)).mappings().one()
        return Verification.model_validate(dict(row))

    def delete_for_profile(self, profile_id: int) -> None:
        attempt_ids = select(self.attempts.c.id).where(self.attempts.c.profile_id == profile_id)
        with self.engine.begin() as connection:
            connection.execute(delete(self.verifications).where(self.verifications.c.attempt_id.in_(attempt_ids)))
            for table in (self.attempts, self.ratings, self.levels, self.sessions, self.skill_states):
                connection.execute(delete(table).where(table.c.profile_id == profile_id))


def make_sql_play_repository(*, engine: Engine) -> SqlPlayRepository:
    metadata = MetaData()
    levels = Table(
        "level",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("profile_id", Integer, nullable=False),
        Column("game_id", String, nullable=False),
        Column("value", Integer, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        UniqueConstraint("profile_id", "game_id"),
    )
    attempts = Table(
        "attempt",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("item_id", String, nullable=False),
        Column("profile_id", Integer, nullable=False),
        Column("game_id", String, nullable=False),
        Column("variant_id", String),
        Column("session_id", String),
        Column("level", Integer, nullable=False),
        Column("correct", Boolean),
        Column("score", Float(asdecimal=False)),
        Column("hints_used", Integer, nullable=False),
        Column("time_ms", Integer, nullable=False),
        Column("details", JSON),
        Column("created_at", DateTime, nullable=False),
    )
    ratings = Table(
        "rating",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("profile_id", Integer, nullable=False),
        Column("game_id", String, nullable=False),
        Column("variant_id", String),
        # Stored by enum *name* (FACES, STARS_1_5), as SQLAlchemy has always done here.
        Column("scale", SqlEnum(RatingScale), nullable=False),
        Column("value", Integer, nullable=False),
        Column("created_at", DateTime, nullable=False),
    )
    verifications = Table(
        "verification",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("attempt_id", Integer, ForeignKey("attempt.id"), nullable=False),
        Column("correct", Boolean, nullable=False),
        Column("verified_at", DateTime, nullable=False),
        Column("verified_by", String, nullable=False),
    )
    sessions = Table(
        "playsession",
        metadata,
        Column("id", String, primary_key=True),
        Column("profile_id", Integer, nullable=False),
        Column("game_id", String, nullable=False),
        Column("variant_id", String),
        Column("started_at", DateTime, nullable=False),
        Column("ended_at", DateTime),
    )
    skills = Table(
        "skill",
        metadata,
        Column("id", String, primary_key=True),
        Column("title", String, nullable=False),
        Column("description", String),
    )
    skill_states = Table(
        "skillstate",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("profile_id", Integer, nullable=False),
        Column("skill_id", String, ForeignKey("skill.id"), nullable=False),
        Column("mastery_level", Integer, nullable=False),
        UniqueConstraint("profile_id", "skill_id"),
    )
    variants = Table(
        "variant",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("game_id", String, nullable=False),
        Column("key", String, nullable=False),
        Column("title", String, nullable=False),
        Column("config", JSON),
        Column("is_active", Boolean, nullable=False),
    )
    return SqlPlayRepository(
        engine=engine,
        levels=levels,
        attempts=attempts,
        ratings=ratings,
        verifications=verifications,
        sessions=sessions,
        skill_states=skill_states,
        skills=skills,
        variants=variants,
        metadata=metadata,
    )
