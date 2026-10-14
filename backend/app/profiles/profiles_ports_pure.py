"""What the profiles feature needs from outside, the commands it offers, and its
domain errors. Assembly supplies the implementations; tests supply fakes."""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.profiles.profiles_schemas_pure import (
    AvatarImage,
    LocalSeedProfile,
    NewProfile,
    PhotoRecord,
    ProfileCreate,
    ProfilePhotoRead,
    ProfilePhotoRemixRequest,
    ProfilePhotoRemixResponse,
    ProfileRead,
    ProfileRecord,
    ProfileUpdate,
)

Clock = Callable[[], datetime]
# Whether a password is the admin password (the admin feature's check).
IsAdminPassword = Callable[[str | None], bool]
# Deletes everything other features keep for a profile, before the profile itself goes.
EraseProfileData = Callable[[int], None]
# Whether a parent account exists (the parents feature's check), for linking a kid.
ParentExists = Callable[[int], bool]


class ProfileRepository(Protocol):
    """Profiles, their saved pictures, and their password hashes."""

    def list_all(self) -> tuple[ProfileRecord, ...]: ...

    def get(self, profile_id: int) -> ProfileRecord | None: ...

    def insert(self, profile: NewProfile) -> ProfileRecord: ...

    def update(self, profile: ProfileRecord) -> ProfileRecord: ...

    def delete(self, profile_id: int) -> None:
        """The profile row, its photo rows, and its password."""
        ...

    def names(self, profile_ids: Sequence[int]) -> Mapping[int, str]: ...

    def with_avatar_prefix(self, prefix: str) -> tuple[ProfileRecord, ...]: ...

    def list_photos(self, profile_id: int) -> tuple[PhotoRecord, ...]:
        """Oldest first."""
        ...

    def get_photo(self, photo_id: int) -> PhotoRecord | None: ...

    def add_photo(self, profile_id: int, url: str, label: str, created_at: datetime) -> None: ...

    def owns_photo(self, profile_id: int, url: str) -> bool: ...

    def delete_photo(self, photo_id: int) -> None: ...

    def password_hash(self, profile_id: int) -> str | None: ...

    def protected_ids(self) -> frozenset[int]: ...

    def set_password_hash(self, profile_id: int, password_hash: str) -> None: ...

    def delete_password(self, profile_id: int) -> None: ...

    def parent_links(self) -> Mapping[int, int]:
        """Kid profile id -> parent id, for every linked kid."""
        ...

    def set_parent(self, profile_id: int, parent_id: int) -> None: ...

    def clear_parent(self, profile_id: int) -> None: ...

    def clear_parent_links(self, parent_id: int) -> None:
        """Unlinks every kid from a parent that's going away."""
        ...


class PhotoStore(Protocol):
    """Picture files served under /static/profile-avatars/."""

    def save(self, image: AvatarImage) -> str:
        """Returns the URL the frontend loads it from."""
        ...

    def delete(self, url: str) -> None:
        """No-op for anything that isn't one of this store's files."""
        ...


class PhotoRemixer(Protocol):
    """The AI image service. None when none is configured, or the call failed."""

    def __call__(self, image: AvatarImage, prompt: str) -> AvatarImage | None: ...


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...

    def matches(self, password: str, stored: str) -> bool: ...


@dataclass(frozen=True)
class ProfileNeighbors:
    """What profiles asks of the other features, through assembly."""

    is_admin_password: IsAdminPassword
    erase_profile_data: EraseProfileData
    parent_exists: ParentExists


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: int) -> None:
        super().__init__(f"no profile with id {profile_id}")


class InvalidProfileError(ValueError):
    """Bad input (a 422), with the message the API returns."""


class WrongProfilePasswordError(PermissionError):
    def __init__(self) -> None:
        super().__init__("wrong password for this profile")


class NotAdminError(PermissionError):
    def __init__(self) -> None:
        super().__init__("invalid admin password")


class PhotoNotFoundError(LookupError):
    def __init__(self, photo_id: int, profile_id: int) -> None:
        super().__init__(f"no photo {photo_id} on profile {profile_id}")


class CurrentPhotoError(ValueError):
    def __init__(self) -> None:
        super().__init__("that's the current profile picture — switch to another one first")


class RemixUnavailableError(RuntimeError):
    def __init__(self) -> None:
        super().__init__("AI photo remix isn't available right now")


@dataclass(frozen=True)
class ProfilesService:
    list_profiles: Callable[[], tuple[ProfileRead, ...]]
    create_profile: Callable[[ProfileCreate], ProfileRead]
    # (profile_id, password): raises unless it unlocks the profile.
    unlock: Callable[[int, str], None]
    # (profile_id, change, profile password header, admin password header)
    update_profile: Callable[[int, ProfileUpdate, str | None, str | None], ProfileRead]
    list_photos: Callable[[int, str | None, str | None], tuple[ProfilePhotoRead, ...]]
    delete_photo: Callable[[int, int, str | None, str | None], None]
    # (profile_id, admin password header): admin-only, checked before anything else.
    delete_profile: Callable[[int, str | None], None]
    # Startup: the demo profile on an empty database, the optional local tester, and
    # photo avatars from before saved pictures existed.
    seed: Callable[[LocalSeedProfile | None], None]
    # Read access for other features (through assembly).
    exists: Callable[[int], bool]
    birth_year: Callable[[int], int | None]
    names: Callable[[Sequence[int]], Mapping[int, str]]
    # The kids linked to a parent, in id order.
    kids_of: Callable[[int], tuple[ProfileRead, ...]]
    # Unlinks every kid from a parent (before the parent is deleted).
    unlink_parent: Callable[[int], None]


@dataclass(frozen=True)
class PhotoRemixService:
    # A remix preview of a photo; nothing is saved.
    remix_preview: Callable[[ProfilePhotoRemixRequest], ProfilePhotoRemixResponse]
