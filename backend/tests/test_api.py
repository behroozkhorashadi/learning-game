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


def _rating_event_count(profile_id: int) -> int:
    with Session(engine) as session:
        rows = session.exec(
            select(Event).where(
                Event.profile_id == profile_id, Event.event_type == EventType.RATING_GIVEN
            )
        ).all()
        return len(rows)


def test_rating_out_of_range_is_rejected(client):
    response = client.post(
        "/api/ratings",
        json={"profile_id": 1, "game_id": "syllable_builder", "scale": "stars_1_5", "value": 6},
    )

    assert response.status_code == 422


def test_rating_for_unknown_profile_is_rejected(client):
    response = client.post(
        "/api/ratings",
        json={"profile_id": 999, "game_id": "syllable_builder", "scale": "stars_1_5", "value": 5},
    )

    assert response.status_code == 404


def test_valid_rating_appends_exactly_one_event(client):
    before = _rating_event_count(profile_id=1)

    response = client.post(
        "/api/ratings",
        json={"profile_id": 1, "game_id": "syllable_builder", "scale": "stars_1_5", "value": 4},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["value"] == 4
    assert body["scale"] == "stars_1_5"
    after = _rating_event_count(profile_id=1)
    assert after - before == 1


def _verification_event_count(profile_id: int) -> int:
    with Session(engine) as session:
        rows = session.exec(
            select(Event).where(
                Event.profile_id == profile_id,
                Event.event_type == EventType.VERIFICATION_COMPLETED,
            )
        ).all()
        return len(rows)


def _post_attempt(client) -> dict:
    item = _get_item(client)
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
    return response.json()


def test_verification_for_unknown_attempt_is_rejected(client):
    response = client.post(
        "/api/verifications", json={"attempt_id": 999999, "correct": True}
    )

    assert response.status_code == 404


def test_valid_verification_appends_exactly_one_event(client):
    attempt = _post_attempt(client)
    before = _verification_event_count(profile_id=1)

    response = client.post(
        "/api/verifications", json={"attempt_id": attempt["id"], "correct": True}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["attempt_id"] == attempt["id"]
    assert body["correct"] is True
    assert body["verified_by"] == "parent"
    after = _verification_event_count(profile_id=1)
    assert after - before == 1
