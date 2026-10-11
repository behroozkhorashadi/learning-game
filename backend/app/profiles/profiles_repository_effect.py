"""SQL storage for profiles over an injected engine. The tables keep the names and
columns the app has always used (`profile`, `profilephoto`, `profilepassword`), so
existing databases work unchanged. The password hash has its own table so it can never
ride along in a serialized profile. Rows are parsed back through the records."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    delete,
    insert,
    select,
    update,
)

from app.profiles.profiles_schemas_pure import NewProfile, PhotoRecord, ProfileRecord


@dataclass(frozen=True)
class SqlProfileRepository:
    engine: Engine
    profiles: Table
    photos: Table
    passwords: Table
    metadata: MetaData

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

    def list_all(self) -> tuple[ProfileRecord, ...]:
        with self.engine.connect() as connection:
            rows = connection.execute(select(self.profiles).order_by(self.profiles.c.id)).mappings().all()
        return tuple(ProfileRecord.model_validate(dict(row)) for row in rows)

    def get(self, profile_id: int) -> ProfileRecord | None:
        query = select(self.profiles).where(self.profiles.c.id == profile_id)
        with self.engine.connect() as connection:
            row = connection.execute(query).mappings().first()
        return None if row is None else ProfileRecord.model_validate(dict(row))

    def insert(self, profile: NewProfile) -> ProfileRecord:
        values = profile.model_dump(exclude_none=profile.id is None)
        with self.engine.begin() as connection:
            new_id = connection.execute(
                insert(self.profiles).values(**values).returning(self.profiles.c.id)
            ).scalar_one()
        stored = self.get(int(new_id))
        if stored is None:
            msg = "profile vanished after insert"
            raise LookupError(msg)
        return stored

    def update(self, profile: ProfileRecord) -> ProfileRecord:
        with self.engine.begin() as connection:
            connection.execute(
                update(self.profiles)
                .where(self.profiles.c.id == profile.id)
                .values(**profile.model_dump(exclude={"id"}))
            )
        stored = self.get(profile.id)
        if stored is None:
            msg = f"profile {profile.id} vanished after update"
            raise LookupError(msg)
        return stored

    def delete(self, profile_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.photos).where(self.photos.c.profile_id == profile_id))
            connection.execute(delete(self.passwords).where(self.passwords.c.profile_id == profile_id))
            connection.execute(delete(self.profiles).where(self.profiles.c.id == profile_id))

    def names(self, profile_ids: Sequence[int]) -> Mapping[int, str]:
        query = select(self.profiles.c.id, self.profiles.c.name).where(self.profiles.c.id.in_(profile_ids))
        with self.engine.connect() as connection:
            return {int(row.id): str(row.name) for row in connection.execute(query)}

    def with_avatar_prefix(self, prefix: str) -> tuple[ProfileRecord, ...]:
        query = select(self.profiles).where(self.profiles.c.avatar.startswith(prefix)).order_by(self.profiles.c.id)
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return tuple(ProfileRecord.model_validate(dict(row)) for row in rows)

    def list_photos(self, profile_id: int) -> tuple[PhotoRecord, ...]:
        query = select(self.photos).where(self.photos.c.profile_id == profile_id).order_by(self.photos.c.id)
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return tuple(PhotoRecord.model_validate(dict(row)) for row in rows)

    def get_photo(self, photo_id: int) -> PhotoRecord | None:
        with self.engine.connect() as connection:
            row = connection.execute(select(self.photos).where(self.photos.c.id == photo_id)).mappings().first()
        return None if row is None else PhotoRecord.model_validate(dict(row))

    def add_photo(self, profile_id: int, url: str, label: str, created_at: datetime) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                insert(self.photos).values(profile_id=profile_id, url=url, label=label, created_at=created_at)
            )

    def owns_photo(self, profile_id: int, url: str) -> bool:
        query = select(self.photos.c.id).where(self.photos.c.profile_id == profile_id, self.photos.c.url == url)
        with self.engine.connect() as connection:
            return connection.execute(query).first() is not None

    def delete_photo(self, photo_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.photos).where(self.photos.c.id == photo_id))

    def password_hash(self, profile_id: int) -> str | None:
        query = select(self.passwords.c.password_hash).where(self.passwords.c.profile_id == profile_id)
        with self.engine.connect() as connection:
            found = connection.execute(query).scalar_one_or_none()
        return None if found is None else str(found)

    def protected_ids(self) -> frozenset[int]:
        with self.engine.connect() as connection:
            return frozenset(int(i) for i in connection.execute(select(self.passwords.c.profile_id)).scalars())

    def set_password_hash(self, profile_id: int, password_hash: str) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.passwords).where(self.passwords.c.profile_id == profile_id))
            connection.execute(insert(self.passwords).values(profile_id=profile_id, password_hash=password_hash))

    def delete_password(self, profile_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.passwords).where(self.passwords.c.profile_id == profile_id))


def make_sql_profile_repository(*, engine: Engine) -> SqlProfileRepository:
    metadata = MetaData()
    profiles = Table(
        "profile",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("name", String, nullable=False),
        Column("avatar", String, nullable=False),
        Column("birth_year", Integer, nullable=False),
        Column("reading_support", Boolean, nullable=False),
        Column("created_at", DateTime, nullable=False),
    )
    photos = Table(
        "profilephoto",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("profile_id", Integer, ForeignKey("profile.id"), nullable=False, index=True),
        Column("url", String, nullable=False),
        Column("label", String, nullable=False),
        Column("created_at", DateTime, nullable=False),
    )
    passwords = Table(
        "profilepassword",
        metadata,
        Column("profile_id", Integer, ForeignKey("profile.id"), primary_key=True),
        Column("password_hash", String, nullable=False),
    )
    return SqlProfileRepository(engine=engine, profiles=profiles, photos=photos, passwords=passwords, metadata=metadata)
