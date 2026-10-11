"""The writing layer's saved stories — HANDOFF.md §4. A `Piece` is one kid-written
story/poem/etc. from any writing game (Prompt Forge, Style Remix Lab, Tag-Team Story,
Clue Master, ...); its children are the `Illustration`s the storybook picks up, the
`RevisionPass`es the coach step records, and two game-specific side tables
(`RemixVersion` for Style Remix Lab, `TurnLine` for Tag-Team Story).

`word_count` is always server-computed from `body`, never client-supplied.

These are wire shapes (`make check-api`, and the legacy generated types): names,
fields, and docstrings stay as they were, with pydantic's default `extra="ignore"`.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


def server_set_timestamp() -> datetime:
    """Default factory for fields the server always sets: keeps them optional in the
    published schema (as they always were) without inventing a value."""
    msg = "this timestamp is set by the server"
    raise ValueError(msg)


def server_set_id() -> str:
    msg = "this id is set by the server"
    raise ValueError(msg)


class TurnAuthor(StrEnum):
    """Who wrote a given `TurnLine` in the Tag-Team Story game — HANDOFF.md §4.
    Tag-Team turns are one line at a time; the kid writes most of them."""

    KID = "kid"
    AI = "ai"


class PieceCreate(BaseModel):
    """Inbound POST body for /api/pieces. Not a table — `Piece` is the
    persisted shape."""

    model_config = ConfigDict(frozen=True)

    profile_id: int
    game_id: str
    session_id: str | None = None
    title: str | None = None
    body: str = ""
    constraints: list[str] = Field(default_factory=list)
    art_style: str | None = None


class PieceUpdate(BaseModel):
    """Inbound PATCH body for /api/pieces/{piece_id} — the revise step edits
    title and/or body; both are optional so a caller can send just one."""

    model_config = ConfigDict(frozen=True)

    title: str | None = None
    body: str | None = None


class Piece(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=server_set_id)
    profile_id: int
    game_id: str
    session_id: str | None = None
    title: str | None = None
    body: str = ""
    word_count: int = 0
    constraints: list[str] = Field(default_factory=list)
    art_style: str | None = None
    created_at: datetime = Field(default_factory=server_set_timestamp)
    revised_at: datetime | None = None


class IllustrationCreate(BaseModel):
    """Inbound POST body for /api/pieces/{piece_id}/illustrations."""

    model_config = ConfigDict(frozen=True)

    prompt_excerpt: str
    image_url: str
    order: int = 0
    is_hero: bool = False


class IllustrationGenerateRequest(BaseModel):
    """Inbound POST body for /api/pieces/{piece_id}/illustrations/generate —
    same shape as IllustrationCreate minus `image_url`, since the server
    generates that itself (app/services/image_generation.py)."""

    model_config = ConfigDict(frozen=True)

    prompt_excerpt: str
    order: int = 0
    is_hero: bool = False


class Illustration(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int | None = None
    piece_id: str
    prompt_excerpt: str
    image_url: str
    order: int = 0
    is_hero: bool = False
    created_at: datetime = Field(default_factory=server_set_timestamp)


class RevisionPassCreate(BaseModel):
    """Inbound POST body for /api/pieces/{piece_id}/revisions — recorded once
    per coach pass, whether or not the kid actually changed anything (the
    illustration gate needs to know `changed`, not just that the step ran)."""

    model_config = ConfigDict(frozen=True)

    questions_asked: list[str] = Field(default_factory=list)
    changed: bool = False


class RevisionPass(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int | None = None
    piece_id: str
    questions_asked: list[str] = Field(default_factory=list)
    changed: bool = False
    completed_at: datetime = Field(default_factory=server_set_timestamp)


class RemixVersionCreate(BaseModel):
    """Inbound POST body for /api/pieces/{piece_id}/remixes — Style Remix Lab only."""

    model_config = ConfigDict(frozen=True)

    style_key: str
    body: str
    is_favourite: bool = False


class RemixVersion(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int | None = None
    piece_id: str
    style_key: str
    body: str
    is_favourite: bool = False
    created_at: datetime = Field(default_factory=server_set_timestamp)


class TurnLineCreate(BaseModel):
    """Inbound POST body for /api/pieces/{piece_id}/turns — Tag-Team Story only."""

    model_config = ConfigDict(frozen=True)

    author: TurnAuthor
    text: str
    order: int = 0


class TurnLine(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int | None = None
    piece_id: str
    author: TurnAuthor
    text: str
    order: int = 0
    created_at: datetime = Field(default_factory=server_set_timestamp)


@dataclass(frozen=True)
class GeneratedImage:
    content: bytes
    content_type: str = "image/png"
