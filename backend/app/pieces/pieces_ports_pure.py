"""What the pieces feature needs from outside, the commands it offers, and its errors.
Assembly supplies the implementations; tests supply fakes."""

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.pieces.pieces_schemas_pure import (
    GeneratedImage,
    Illustration,
    IllustrationCreate,
    IllustrationGenerateRequest,
    Piece,
    PieceCreate,
    PieceUpdate,
    RemixVersion,
    RemixVersionCreate,
    RevisionPass,
    RevisionPassCreate,
    TurnLine,
    TurnLineCreate,
)

Clock = Callable[[], datetime]


class PieceRepository(Protocol):
    def get(self, piece_id: str) -> Piece | None: ...

    def list_for(self, profile_id: int, game_id: str | None) -> tuple[Piece, ...]: ...

    def save(self, piece: Piece) -> Piece:
        """Inserts or replaces the piece; returns it as stored."""
        ...

    def delete(self, piece_id: str) -> None:
        """The piece and all its child rows (no DB-level cascade is configured)."""
        ...

    def illustrations(self, piece_id: str) -> tuple[Illustration, ...]: ...

    def add_illustration(self, illustration: Illustration) -> Illustration: ...

    def add_revision(self, revision: RevisionPass) -> RevisionPass: ...

    def add_remix(self, remix: RemixVersion) -> RemixVersion: ...

    def add_turn(self, turn: TurnLine) -> TurnLine: ...

    def game_ids_for(self, profile_id: int) -> tuple[str, ...]:
        """One entry per piece the profile has (for badges and stats)."""
        ...

    def delete_for_profile(self, profile_id: int) -> None: ...


class ImageGenerator(Protocol):
    """The illustration provider. None (never an exception) when no provider is
    configured or the call failed, so the frontend's placeholder art shows instead."""

    def __call__(self, prompt: str, style: str | None) -> GeneratedImage | None: ...


class IllustrationStore(Protocol):
    def save(self, piece_id: str, image: GeneratedImage) -> str:
        """Returns the URL the frontend loads it from."""
        ...


class PieceEvents(Protocol):
    def append(
        self,
        *,
        profile_id: int,
        game_id: str,
        event_type: str,
        payload: Mapping[str, object],
        variant_id: str | None,
        session_id: str | None,
    ) -> str: ...


@dataclass(frozen=True)
class PieceOutputs:
    """Where generated pictures come from and where they're kept."""

    images: ImageGenerator
    store: IllustrationStore


@dataclass(frozen=True)
class PieceNeighbors:
    profile_exists: Callable[[int], bool]
    # After a piece is created: (profile_id, session_id). Awards badges.
    after_piece: Callable[[int, str | None], None]


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: int) -> None:
        super().__init__(f"no profile with id {profile_id}")


class PieceNotFoundError(LookupError):
    def __init__(self, piece_id: str) -> None:
        super().__init__(f"no piece with id {piece_id}")


@dataclass(frozen=True)
class PiecesService:
    create: Callable[[PieceCreate], Piece]
    # Arguments: the profile id, and a game id to filter by (or None for every game).
    list_for: Callable[[int, str | None], tuple[Piece, ...]]
    get: Callable[[str], Piece]
    revise: Callable[[str, PieceUpdate], Piece]
    delete: Callable[[str], None]
    illustrations: Callable[[str], tuple[Illustration, ...]]
    add_illustration: Callable[[str, IllustrationCreate], Illustration]
    generate_illustration: Callable[[str, IllustrationGenerateRequest], Illustration]
    add_revision: Callable[[str, RevisionPassCreate], RevisionPass]
    add_remix: Callable[[str, RemixVersionCreate], RemixVersion]
    add_turn: Callable[[str, TurnLineCreate], TurnLine]
    game_ids_for: Callable[[int], tuple[str, ...]]
    delete_for_profile: Callable[[int], None]
