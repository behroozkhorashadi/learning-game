"""Fakes and builders for the profiles feature: a ticking clock, a recording remixer,
fixed password salts, and a recorder for the cross-feature erase port. The repository
and photo store under test are the real ones over tmp_path."""

import base64
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from itertools import count
from pathlib import Path

from sqlalchemy import create_engine

from app.profiles.profile_passwords_service_effect import make_scrypt_password_hasher
from app.profiles.profile_photos_repository_effect import FilePhotoStore, make_file_photo_store
from app.profiles.profiles_ports_pure import ProfileNeighbors, ProfilesService
from app.profiles.profiles_repository_effect import SqlProfileRepository, make_sql_profile_repository
from app.profiles.profiles_schemas_pure import AvatarImage
from app.profiles.profiles_service_effect import make_profiles_service

START = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)
YEAR = START.year
ADMIN_PASSWORD = "admin-secret"
PHOTO_DATA_URL = "data:image/png;base64," + base64.b64encode(b"fake-png-bytes").decode()


class TickingClock:
    """Each reading is one millisecond after the last."""

    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        reading = self.now
        self.now += timedelta(milliseconds=1)
        return reading


@dataclass
class FakeRemixer:
    """Returns `result` (None means "unavailable") and records each prompt."""

    result: AvatarImage | None = field(
        default_factory=lambda: AvatarImage(content=b"remixed", content_type="image/jpeg")
    )
    prompts: list[str] = field(default_factory=list[str])

    def __call__(self, image: AvatarImage, prompt: str) -> AvatarImage | None:
        self.prompts.append(prompt)
        return self.result


@dataclass
class EraseRecorder:
    erased: list[int] = field(default_factory=list[int])

    def __call__(self, profile_id: int) -> None:
        self.erased.append(profile_id)


# The parent ids the fake parents feature knows; any other id can't be linked.
PARENT_IDS = frozenset({10, 11})


def parent_exists(parent_id: int) -> bool:
    return parent_id in PARENT_IDS


def is_admin(password: str | None) -> bool:
    return password == ADMIN_PASSWORD


def fixed_salts() -> Iterator[bytes]:
    return (n.to_bytes(16, "big") for n in count(1))


@dataclass(frozen=True)
class Harness:
    service: ProfilesService
    repository: SqlProfileRepository
    photos: FilePhotoStore
    erased: EraseRecorder


def harness(tmp_path: Path) -> Harness:
    repository = make_sql_profile_repository(engine=create_engine(f"sqlite:///{tmp_path / 'profiles.db'}"))
    repository.create_schema()
    names = (f"photo{n}" for n in count(1))
    photos = make_file_photo_store(directory=tmp_path / "avatars", new_name=lambda: next(names))
    salts = fixed_salts()
    erased = EraseRecorder()
    service = make_profiles_service(
        repository=repository,
        photo_store=photos,
        hasher=make_scrypt_password_hasher(new_salt=lambda: next(salts)),
        neighbors=ProfileNeighbors(is_admin_password=is_admin, erase_profile_data=erased, parent_exists=parent_exists),
        clock=TickingClock(),
    )
    return Harness(service=service, repository=repository, photos=photos, erased=erased)


def photo(label: str = "Original", *, use: bool = False, data_url: str = PHOTO_DATA_URL) -> dict[str, object]:
    return {"image_data_url": data_url, "label": label, "use_as_avatar": use}


def files(directory: Path) -> list[str]:
    return sorted(p.name for p in directory.iterdir()) if directory.exists() else []
