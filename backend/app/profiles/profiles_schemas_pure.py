"""Player profiles — PRD §4, §8 — their saved pictures, and their optional password.

Age is stored as a birth year rather than a named band: bands read as ambiguous
buckets, a birth year is a concrete fact the age can always be derived from.

The request/response models are wire shapes: their names, fields, and docstrings are
the API contract the frontend's types are generated from (`make check-api`), so they
keep pydantic's default `extra="ignore"` and their docstrings verbatim. The records
are what the repository stores.
"""

from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel, ConfigDict

# Generic avatar keys the create-profile screen offers. None has real art yet, so the
# frontend's ProfileAvatar shows each one's emoji. Mirrored by hand in the frontend
# (src/profiles/avatar_options.pure.lib.ts). A local dev machine may seed an extra
# profile with a real kid's photo (LOCAL_SEED_PROFILE_* in backend/.env.example).
AVATAR_OPTIONS = ("fox", "owl", "bear", "cat", "panda", "rabbit")

# Sanity bounds on a new profile's age, not a product requirement: wide enough to catch
# an obvious typo (a future date, or a birth year that'd make the player an adult).
MIN_AGE = 1
MAX_AGE = 99

MIN_PASSWORD_LENGTH = 4
MAX_PASSWORD_LENGTH = 128


class NewProfilePhoto(BaseModel):
    """One photo (the camera original or an AI remix of it) to add to a
    profile's saved pictures on create/update. Every version a kid made gets
    saved, so they can switch back to any of them later; `use_as_avatar`
    marks the one to show right now (at most one per request)."""

    model_config = ConfigDict(frozen=True)

    image_data_url: str
    label: str = "Photo"
    use_as_avatar: bool = False


class ProfilePhotoRead(BaseModel):
    """A saved picture as GET /api/profiles/{id}/photos returns it."""

    model_config = ConfigDict(frozen=True)

    id: int
    url: str
    label: str
    created_at: datetime


class ProfileCreate(BaseModel):
    """Inbound POST body for /api/profiles. Not a table — `Profile` is the
    persisted shape."""

    model_config = ConfigDict(frozen=True)

    name: str
    avatar: str
    birth_year: int
    reading_support: bool = False
    # Photos to save with the new profile; if one is `use_as_avatar`, its saved
    # /static path replaces `avatar`.
    new_photos: list[NewProfilePhoto] = []
    # Optional: a profile without one works exactly as before (anyone can pick it).
    password: str | None = None
    # Optional: the grown-up (GET /api/parents) who can see this kid's progress.
    parent_id: int | None = None


class ProfileUpdate(BaseModel):
    """Inbound PATCH body for /api/profiles/{profile_id} (admin-only — see
    `app/admin_auth.py`). All fields optional so a caller can send just the
    ones changing, same pattern as `PieceUpdate`."""

    model_config = ConfigDict(frozen=True)

    name: str | None = None
    # An animal key, or the /static URL of one of this profile's saved photos.
    avatar: str | None = None
    birth_year: int | None = None
    reading_support: bool | None = None
    # A `use_as_avatar` photo takes precedence over `avatar` if both are sent.
    new_photos: list[NewProfilePhoto] = []
    # Sets (or changes) the password. `remove_password` clears it; both is a 422.
    password: str | None = None
    remove_password: bool = False
    # Links the kid to a parent (or moves them to another). `remove_parent` unlinks;
    # both is a 422.
    parent_id: int | None = None
    remove_parent: bool = False


class ProfileUnlockRequest(BaseModel):
    """Inbound POST body for /api/profiles/{profile_id}/unlock — the
    profile's own password, or the admin password as an override."""

    model_config = ConfigDict(frozen=True)

    password: str


class ProfilePhotoRemixRequest(BaseModel):
    """Inbound POST body for /api/profile-photos/remix — a preview only;
    nothing is saved until the chosen result comes back on a create/update."""

    model_config = ConfigDict(frozen=True)

    image_data_url: str
    style: str | None = None
    idea: str | None = None


class ProfilePhotoRemixResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    image_data_url: str


class ProfileRead(BaseModel):
    """What the API returns for a profile: `Profile` plus whether it's
    password-protected. This, not the table row, is the shape the frontend
    ever sees."""

    model_config = ConfigDict(frozen=True)

    id: int | None = None
    name: str
    avatar: str
    birth_year: int
    reading_support: bool = False
    created_at: datetime | None = None
    has_password: bool = False
    # The parent this kid is linked to, if any.
    parent_id: int | None = None


class ProfileRecord(BaseModel):
    """A stored profile, one per kid. `reading_support` is an independent per-profile
    flag, not an age rule — PRD §8 (our fluent-reading 6yo has it off)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: int
    name: str
    avatar: str
    birth_year: int
    reading_support: bool
    created_at: datetime


class NewProfile(BaseModel):
    """A profile about to be stored. `id` is None except for the seeded profiles,
    which keep stable ids (1 for the demo, 2 for a local tester)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: int | None
    name: str
    avatar: str
    birth_year: int
    reading_support: bool
    created_at: datetime


class PhotoRecord(BaseModel):
    """A saved picture belonging to a profile: the camera original or one of its AI
    remixes. The profile's `avatar` points at one of these `url`s when it uses a photo;
    the others stay around to switch back to."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: int
    profile_id: int
    url: str
    label: str
    created_at: datetime


@dataclass(frozen=True)
class AvatarImage:
    """Decoded picture bytes: a PNG or JPEG."""

    content: bytes
    content_type: str


@dataclass(frozen=True)
class LocalSeedProfile:
    """An optional second seed profile for a real named tester, kept out of the repo
    (LOCAL_SEED_PROFILE_* in backend/.env.example). Its id (2) is stable, so their
    history survives restarts."""

    name: str
    avatar: str
    birth_year: int
