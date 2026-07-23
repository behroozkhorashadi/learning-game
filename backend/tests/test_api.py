"""API-level tests — PRD §6, §11: the telemetry-core floor is enforced on
POST /api/attempts, and a valid attempt appends exactly one event."""

from sqlmodel import Session, select

from app.db import engine
from app.models.enums import EventType
from app.models.event import Event


def _attempt_event_count(profile_id: int) -> int:
    with Session(engine) as session:
        rows = session.exec(
            select(Event).where(
                Event.profile_id == profile_id, Event.event_type == EventType.ATTEMPT
            )
        ).all()
        return len(rows)


def _get_item(client):
    response = client.get(
        "/api/items/next", params={"profile_id": 1, "game_id": "syllable_builder"}
    )
    assert response.status_code == 200
    return response.json()


def test_attempt_missing_telemetry_core_is_rejected(client):
    item = _get_item(client)

    response = client.post(
        "/api/attempts",
        json={
            "item_id": item["item_id"],
            "profile_id": 1,
            "game_id": "syllable_builder",
            "telemetry": {"hints_used": 0, "time_ms": 1000},  # no correct, no score
            "details": {},
        },
    )

    assert response.status_code == 422


def test_valid_attempt_appends_exactly_one_event(client):
    item = _get_item(client)
    before = _attempt_event_count(profile_id=1)

    response = client.post(
        "/api/attempts",
        json={
            "item_id": item["item_id"],
            "profile_id": 1,
            "game_id": "syllable_builder",
            "telemetry": {"correct": True, "hints_used": 0, "time_ms": 3000},
            "details": {"assembled": item["payload"]["correct_syllables"]},
        },
    )

    assert response.status_code == 201
    after = _attempt_event_count(profile_id=1)
    assert after - before == 1
