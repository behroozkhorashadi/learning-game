"""The append-only telemetry record — PRD §5.3. Every metric both adaptive loops need
derives from this stream; rows are never updated after insert.

`Event` keeps its name and shape: it is exported to the frontend's legacy generated
types."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class EventType(StrEnum):
    """Append-only event types — PRD §5.3. This is the starting set; more get added
    as behavior (Loop A/B, ratings, verification) lands in later milestones."""

    SESSION_START = "session_start"
    SESSION_COMPLETE = "session_complete"
    SESSION_ABANDONED = "session_abandoned"
    ITEM_SHOWN = "item_shown"
    ATTEMPT = "attempt"
    HINT_USED = "hint_used"
    DIFFICULTY_CHANGED = "difficulty_changed"
    REPLAY_CHOSEN = "replay_chosen"
    GAME_SWITCHED = "game_switched"
    QUICK_QUIT = "quick_quit"
    RATING_GIVEN = "rating_given"
    VERIFICATION_COMPLETED = "verification_completed"
    PIECE_CREATED = "piece_created"
    PIECE_REVISED = "piece_revised"
    PIECE_DELETED = "piece_deleted"
    ILLUSTRATION_ADDED = "illustration_added"
    BADGE_AWARDED = "badge_awarded"


def server_set(field: str) -> str:
    """Default factory for fields the log always sets: keeps them optional in the
    exported schema (as they always were) without inventing a value."""
    msg = f"{field} is set by the event log"
    raise ValueError(msg)


def server_set_timestamp() -> datetime:
    msg = "timestamp is set by the event log"
    raise ValueError(msg)


class Event(BaseModel):
    model_config = ConfigDict(frozen=True)

    event_id: str = Field(default_factory=lambda: server_set("event_id"))
    timestamp: datetime = Field(default_factory=server_set_timestamp)
    profile_id: int
    game_id: str
    variant_id: str | None = None
    session_id: str | None = None
    event_type: EventType
    payload: dict[str, object] = Field(default_factory=dict)
