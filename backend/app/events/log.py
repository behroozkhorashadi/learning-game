"""Append-only event log write path — PRD §5.3.

The only way an Event row gets created. No update/delete helper exists on
purpose: events are never mutated after insert.
"""

from typing import Any, Optional

from sqlmodel import Session

from app.models.enums import EventType
from app.models.event import Event


def append_event(
    session: Session,
    *,
    profile_id: int,
    game_id: str,
    event_type: EventType,
    payload: dict[str, Any],
    variant_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Event:
    event = Event(
        profile_id=profile_id,
        game_id=game_id,
        variant_id=variant_id,
        session_id=session_id,
        event_type=event_type,
        payload=payload,
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return event
