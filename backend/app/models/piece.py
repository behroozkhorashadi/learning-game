"""Piece, Illustration, RevisionPass, RemixVersion, TurnLine — the writing-layer
persistence models proposed in the Claude Design handoff (HANDOFF.md §4).

A `Piece` is one kid-written story/poem/etc., produced by any writing-layer
game (Prompt Forge, Style Remix Lab, Tag-Team Story, Clue Master, ...). The
other four models are its children: `Illustration`s the storybook picks up,
`RevisionPass`es recorded by the coach step, and the two game-specific side
tables (`RemixVersion` for Style Remix Lab, `TurnLine` for Tag-Team Story).

`word_count` is always server-computed from `body`, never client-supplied —
same reasoning as `Attempt.level` in attempt.py.
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from app.util import utcnow
from pydantic import BaseModel
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.models.enums import TurnAuthor


class PieceCreate(BaseModel):
    """Inbound POST body for /api/pieces. Not a table — `Piece` is the
    persisted shape."""

    profile_id: int
    game_id: str
    session_id: Optional[str] = None
    title: Optional[str] = None
    body: str = ""
    constraints: list[str] = Field(default_factory=list)
    art_style: Optional[str] = None


class PieceUpdate(BaseModel):
    """Inbound PATCH body for /api/pieces/{piece_id} — the revise step edits
    title and/or body; both are optional so a caller can send just one."""

    title: Optional[str] = None
    body: Optional[str] = None


class Piece(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    profile_id: int = Field(foreign_key="profile.id")
    game_id: str
    session_id: Optional[str] = None
    title: Optional[str] = None
    body: str = ""
    word_count: int = 0
    constraints: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    art_style: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
    revised_at: Optional[datetime] = None


class IllustrationCreate(BaseModel):
    """Inbound POST body for /api/pieces/{piece_id}/illustrations."""

    prompt_excerpt: str
    image_url: str
    order: int = 0
    is_hero: bool = False


class IllustrationGenerateRequest(BaseModel):
    """Inbound POST body for /api/pieces/{piece_id}/illustrations/generate —
    same shape as IllustrationCreate minus `image_url`, since the server
    generates that itself (app/services/image_generation.py)."""

    prompt_excerpt: str
    order: int = 0
    is_hero: bool = False


class Illustration(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    piece_id: str = Field(foreign_key="piece.id")
    prompt_excerpt: str
    image_url: str
    order: int = 0
    is_hero: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class RevisionPassCreate(BaseModel):
    """Inbound POST body for /api/pieces/{piece_id}/revisions — recorded once
    per coach pass, whether or not the kid actually changed anything (the
    illustration gate needs to know `changed`, not just that the step ran)."""

    questions_asked: list[str] = Field(default_factory=list)
    changed: bool = False


class RevisionPass(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    piece_id: str = Field(foreign_key="piece.id")
    questions_asked: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    changed: bool = False
    completed_at: datetime = Field(default_factory=utcnow)


class RemixVersionCreate(BaseModel):
    """Inbound POST body for /api/pieces/{piece_id}/remixes — Style Remix Lab only."""

    style_key: str
    body: str
    is_favourite: bool = False


class RemixVersion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    piece_id: str = Field(foreign_key="piece.id")
    style_key: str
    body: str
    is_favourite: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class TurnLineCreate(BaseModel):
    """Inbound POST body for /api/pieces/{piece_id}/turns — Tag-Team Story only."""

    author: TurnAuthor
    text: str
    order: int = 0


class TurnLine(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    piece_id: str = Field(foreign_key="piece.id")
    author: TurnAuthor
    text: str
    order: int = 0
    created_at: datetime = Field(default_factory=utcnow)
