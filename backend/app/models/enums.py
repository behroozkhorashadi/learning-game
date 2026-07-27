"""Shared enums for the domain model. PRD §4, §5.3."""

from enum import Enum


class EventType(str, Enum):
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


class RatingScale(str, Enum):
    """Explicit engagement rating scale — PRD §5.2."""

    FACES = "faces"
    STARS_1_5 = "stars_1_5"


class TurnAuthor(str, Enum):
    """Who wrote a given `TurnLine` in the Tag-Team Story game — HANDOFF.md §4.
    Tag-Team turns are one line at a time; the kid writes most of them."""

    KID = "kid"
    AI = "ai"
