import pytest
from pydantic import ValidationError

from app.events.events_schemas_pure import Event, EventType
from tests.events.events_fakes import START


def test_event_types_parse_from_their_values() -> None:
    assert EventType("item_shown") is EventType.ITEM_SHOWN
    with pytest.raises(ValueError, match="nope"):
        EventType("nope")


def test_ids_and_timestamps_come_from_the_log() -> None:
    body = {"profile_id": 1, "game_id": "g", "event_type": "attempt"}
    with pytest.raises(ValueError, match="set by the event log"):
        Event.model_validate(body)
    event = Event.model_validate({**body, "event_id": "e1", "timestamp": START})
    assert (event.payload, event.session_id) == ({}, None)
    with pytest.raises(ValidationError):
        Event.model_validate({**body, "event_id": "e1", "timestamp": START, "event_type": "nope"})
