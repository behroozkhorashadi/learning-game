"""Player Profile and per-skill state — PRD §4, §8.

Age is stored as a birth year rather than a named band: bands read as ambiguous
buckets, a birth year is a concrete fact the age can always be derived from.
"""

from datetime import date, datetime
from typing import Optional

from app.util import utcnow
from pydantic import BaseModel
from sqlmodel import Field, SQLModel, UniqueConstraint

# Generic avatar keys the create-profile screen offers — none has real art yet,
# so picking one of these falls back to the profile's initial letter via
# `ProfileAvatar`'s existing onError handling. (A local dev machine may seed an
# extra profile with a real kid's photo as its avatar — see
# LOCAL_SEED_PROFILE_* in backend/.env.example — but that key isn't part of
# this list since it's not reusable art.) Shared with the frontend's
# `CreateProfile.tsx`, which hardcodes the same list rather than round-tripping
# it through an API call.
AVATAR_OPTIONS = ["fox", "owl", "bear", "cat", "panda", "rabbit"]

# Sanity bounds on a new profile's age, not a product requirement — just wide
# enough to catch an obvious typo (a future date, or a birth year that'd make
# the player an infant or an adult) without guessing at a "real" min/max.
MIN_AGE = 3
MAX_AGE = 14


class NewProfilePhoto(BaseModel):
    """One photo (the camera original or an AI remix of it) to add to a
    profile's saved pictures on create/update. Every version a kid made gets
    saved, so they can switch back to any of them later; `use_as_avatar`
    marks the one to show right now (at most one per request)."""

    image_data_url: str
    label: str = "Photo"
    use_as_avatar: bool = False


class ProfilePhotoRead(BaseModel):
    """A saved picture as GET /api/profiles/{id}/photos returns it."""

    id: int
    url: str
    label: str
    created_at: datetime


class ProfileCreate(BaseModel):
    """Inbound POST body for /api/profiles. Not a table — `Profile` is the
    persisted shape."""

    name: str
    avatar: str
    birth_year: int
    reading_support: bool = False
    # Photos to save with the new profile; if one is `use_as_avatar` its
    # saved /static path replaces `avatar`.
    new_photos: list[NewProfilePhoto] = []
    # Optional — a profile without one works exactly as before (anyone can
    # pick it). See `app/services/profile_passwords.py`.
    password: Optional[str] = None


class ProfileUpdate(BaseModel):
    """Inbound PATCH body for /api/profiles/{profile_id} (admin-only — see
    `app/admin_auth.py`). All fields optional so a caller can send just the
    ones changing, same pattern as `PieceUpdate`."""

    name: Optional[str] = None
    # An animal key, or the /static URL of one of this profile's saved photos
    # (switching back to an earlier picture).
    avatar: Optional[str] = None
    birth_year: Optional[int] = None
    reading_support: Optional[bool] = None
    # Same as on `ProfileCreate`; a `use_as_avatar` photo takes precedence
    # over `avatar` if both are sent.
    new_photos: list[NewProfilePhoto] = []
    # Sets (or changes) the profile's password. `remove_password` clears it;
    # sending both is a 422.
    password: Optional[str] = None
    remove_password: bool = False


class ProfileUnlockRequest(BaseModel):
    """Inbound POST body for /api/profiles/{profile_id}/unlock — the
    profile's own password, or the admin password as an override."""

    password: str


class ProfilePhotoRemixRequest(BaseModel):
    """Inbound POST body for /api/profile-photos/remix — a preview only;
    nothing is saved until the chosen result comes back on a create/update."""

    image_data_url: str
    style: Optional[str] = None
    idea: Optional[str] = None


class ProfilePhotoRemixResponse(BaseModel):
    image_data_url: str


class Profile(SQLModel, table=True):
    """One per kid. `reading_support` is an independent per-profile flag, not an
    age rule — PRD §8 (our fluent-reading 6yo has it off)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    avatar: str
    birth_year: int
    reading_support: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utcnow)

    @property
    def age(self) -> int:
        """Approximate current age, derived rather than stored so it never goes stale."""
        return date.today().year - self.birth_year


class ProfileRead(BaseModel):
    """What the API returns for a profile: `Profile` plus whether it's
    password-protected. Exported to the frontend *as* `Profile` (see
    `scripts/generate_ts_types.py`), since this — not the table row — is the
    shape the frontend ever sees."""

    id: Optional[int] = None
    name: str
    avatar: str
    birth_year: int
    reading_support: bool = False
    created_at: Optional[datetime] = None
    has_password: bool = False

    @classmethod
    def of(cls, profile: "Profile", has_password: bool) -> "ProfileRead":
        return cls(**profile.model_dump(), has_password=has_password)


class ProfilePhoto(SQLModel, table=True):
    """A saved picture belonging to a profile — the camera original or one of
    its AI remixes. `Profile.avatar` points at one of these `url`s when the
    profile uses a photo; the others stay around to switch back to."""

    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    url: str
    label: str
    created_at: datetime = Field(default_factory=utcnow)


class ProfilePassword(SQLModel, table=True):
    """A profile's password hash, one row per protected profile. Its own
    table rather than a `Profile` column so the hash can never ride along in
    a serialized `Profile`, and so existing databases pick it up through
    `create_all` with no migration."""

    profile_id: int = Field(foreign_key="profile.id", primary_key=True)
    password_hash: str


class SkillState(SQLModel, table=True):
    """Per-(profile, skill) mastery rollup. Distinct from the per-(profile, game)
    `Level` in game.py: this is the coarser, skill-level summary the mastery
    signal (PRD §5.1) will eventually roll up into. No behavior writes to it yet.
    """

    __table_args__ = (UniqueConstraint("profile_id", "skill_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id")
    skill_id: str = Field(foreign_key="skill.id")
    mastery_level: int = Field(default=1)
