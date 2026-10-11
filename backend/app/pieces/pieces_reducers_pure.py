"""Pure piece rules: word counts, the records a create or a revise produces, the event
payloads, and the illustration prompt."""

from datetime import datetime
from types import MappingProxyType

from app.pieces.pieces_schemas_pure import Piece, PieceCreate, PieceUpdate

PIECE_CREATED = "piece_created"
PIECE_REVISED = "piece_revised"
PIECE_DELETED = "piece_deleted"
ILLUSTRATION_ADDED = "illustration_added"

# Loose, human-readable hints for each `Piece.art_style`, folded into the generation
# prompt so the picture at least leans the right direction.
STYLE_HINTS = MappingProxyType(
    {
        "storybook": "warm, painterly children's storybook illustration",
        "inkwash": "soft ink-and-wash illustration, muted tones",
        "brightpaper": "bright, flat-color paper-cut illustration",
        "chalk": "chalk-drawing illustration on a dark background",
    }
)
DEFAULT_STYLE_HINT = STYLE_HINTS["storybook"]


def word_count(body: str) -> int:
    return len(body.split())


def created_piece(payload: PieceCreate, *, piece_id: str, now: datetime) -> Piece:
    return Piece(
        id=piece_id,
        profile_id=payload.profile_id,
        game_id=payload.game_id,
        session_id=payload.session_id,
        title=payload.title,
        body=payload.body,
        word_count=word_count(payload.body),
        constraints=list(payload.constraints),
        art_style=payload.art_style,
        created_at=now,
    )


def revised_piece(piece: Piece, change: PieceUpdate, *, now: datetime) -> Piece:
    """The revise step edits title and/or body; HANDOFF.md §3's illustration gate reads
    `revised_at`/`word_count` off the result."""
    updates: dict[str, object] = {"revised_at": now}
    if change.title is not None:
        updates["title"] = change.title
    if change.body is not None:
        updates["body"] = change.body
        updates["word_count"] = word_count(change.body)
    return piece.model_copy(update=updates)


def illustration_prompt(prompt: str, style: str | None) -> str:
    hint = STYLE_HINTS.get(style or "", DEFAULT_STYLE_HINT)
    return f"A {hint} for a kid's storybook. No text or lettering anywhere in the image. Scene: {prompt}"
