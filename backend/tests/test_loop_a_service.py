"""Service/API-level wiring tests for Loop A — PRD §5.1, §6, §11.

Exercises the real endpoints (`app.main`) end to end so the test covers the
actual wiring: `process_attempt` persisting a level change and appending a
`difficulty_changed` event with a reason, and `choose_next_item_level` serving
a confidence item after a support decision. The pure rule logic itself is
covered exhaustively in `test_loop_a_engine.py`; these tests only check that
the service plugs it into the DB and event log correctly.
"""

from datetime import date

from sqlmodel import Session, select

from app.db import engine
from app.models.enums import EventType
from app.models.event import Event
from app.models.game import Level
from app.models.profile import Profile

GAME_ID = "syllable_builder"
_next_profile_id = 1000


def _new_profile() -> int:
    global _next_profile_id
    _next_profile_id += 1
    pid = _next_profile_id
    with Session(engine) as session:
        session.add(Profile(id=pid, name=f"Test Kid {pid}", avatar="owl", birth_year=2018))
        session.commit()
    return pid


def _get_item(client, profile_id: int) -> dict:
    response = client.get(
        "/api/items/next", params={"profile_id": profile_id, "game_id": GAME_ID}
    )
    assert response.status_code == 200
    return response.json()


def _post_attempt(client, profile_id: int, item: dict, *, correct: bool, hints_used: int = 0) -> dict:
    response = client.post(
        "/api/attempts",
        json={
            "item_id": item["item_id"],
            "profile_id": profile_id,
            "game_id": GAME_ID,
            "telemetry": {"correct": correct, "hints_used": hints_used, "time_ms": 1000},
            "details": {},
        },
    )
    assert response.status_code == 201
    return response.json()


def _play_round(client, profile_id: int, *, correct: bool, hints_used: int = 0) -> dict:
    item = _get_item(client, profile_id)
    return _post_attempt(client, profile_id, item, correct=correct, hints_used=hints_used)


def _current_level(profile_id: int) -> int:
    with Session(engine) as session:
        level = session.exec(
            select(Level).where(Level.profile_id == profile_id, Level.game_id == GAME_ID)
        ).first()
        return level.value if level else 1


def _difficulty_changed_events(profile_id: int) -> list[Event]:
    with Session(engine) as session:
        return list(
            session.exec(
                select(Event).where(
                    Event.profile_id == profile_id,
                    Event.event_type == EventType.DIFFICULTY_CHANGED,
                )
            ).all()
        )


def test_promote_persists_level_change_and_appends_reasoned_event(client):
    profile_id = _new_profile()

    for _ in range(5):
        _play_round(client, profile_id, correct=True, hints_used=0)

    assert _current_level(profile_id) == 2

    events = _difficulty_changed_events(profile_id)
    assert len(events) == 1
    assert events[0].payload["from"] == 1
    assert events[0].payload["to"] == 2
    assert isinstance(events[0].payload["reason"], str) and events[0].payload["reason"]


def test_hold_band_does_not_change_level_or_append_event(client):
    profile_id = _new_profile()

    for correct in [True, True, True, False, False]:
        _play_round(client, profile_id, correct=correct, hints_used=0)

    assert _current_level(profile_id) == 1
    assert _difficulty_changed_events(profile_id) == []


def test_frustration_guard_offers_hint_on_second_consecutive_wrong(client):
    profile_id = _new_profile()

    first = _play_round(client, profile_id, correct=False, hints_used=0)
    assert first["hint_offered"] is False

    second = _play_round(client, profile_id, correct=False, hints_used=0)
    assert second["hint_offered"] is True

    # Guard never changes the level, and fires before the window (K=5) is full.
    assert _current_level(profile_id) == 1
    assert _difficulty_changed_events(profile_id) == []


def test_support_serves_a_confidence_item_on_the_next_request_only(client):
    profile_id = _new_profile()

    # Promote twice (1 -> 2 -> 3) so a subsequent support has room to drop to 2.
    for _ in range(10):
        _play_round(client, profile_id, correct=True, hints_used=0)
    assert _current_level(profile_id) == 3

    # Support fires: 5 wrong in a row at level 3.
    for _ in range(5):
        _play_round(client, profile_id, correct=False, hints_used=0)
    assert _current_level(profile_id) == 2

    events = _difficulty_changed_events(profile_id)
    assert events[-1].payload["to"] == 2
    assert events[-1].payload["needs_confidence_item"] is True

    confidence_item = _get_item(client, profile_id)
    assert confidence_item["level"] == 1  # one below the new current level (2)

    with Session(engine) as session:
        shown = list(
            session.exec(
                select(Event).where(
                    Event.profile_id == profile_id, Event.event_type == EventType.ITEM_SHOWN
                )
            ).all()
        )
    assert shown[-1].payload["pacing"] == "confidence"

    # Self-expires: the next item request is no longer forced to be a confidence item.
    _get_item(client, profile_id)
    with Session(engine) as session:
        shown_again = list(
            session.exec(
                select(Event).where(
                    Event.profile_id == profile_id, Event.event_type == EventType.ITEM_SHOWN
                )
            ).all()
        )
    assert shown_again[-1].payload["pacing"] != "confidence"


def test_a_young_kid_who_keeps_mastering_is_promoted_past_their_age_level(client):
    """Age sets the pace, never a ceiling: a 6-year-old acing equation_builder
    must eventually reach the ×/÷ tier (level 8+), which is typical from age 8.
    Previously the age cap held them at level 7 forever no matter how well they
    played."""
    with Session(engine) as session:
        profile_id = 2000
        session.add(Profile(id=profile_id, name="Young Kid", avatar="owl", birth_year=date.today().year - 6))
        session.commit()

    game_id = "equation_builder"
    for _ in range(20 * 5):
        item = client.get("/api/items/next", params={"profile_id": profile_id, "game_id": game_id}).json()
        client.post(
            "/api/attempts",
            json={
                "item_id": item["item_id"],
                "profile_id": profile_id,
                "game_id": game_id,
                "telemetry": {"correct": True, "hints_used": 0, "time_ms": 1000},
                "details": {},
            },
        )

    with Session(engine) as session:
        level = session.exec(
            select(Level).where(Level.profile_id == profile_id, Level.game_id == game_id)
        ).first()
    assert level.value >= 8


def test_promotion_past_age_level_needs_a_longer_streak(client):
    """A 9-year-old in fact_fluency sits at L6, the top of the age-typical
    +/− range. The usual 3 fast correct answers no longer promote; a 4th does."""
    profile_id = 2002
    game_id = "fact_fluency"
    with Session(engine) as session:
        session.add(Profile(id=profile_id, name="Nine", avatar="owl", birth_year=date.today().year - 9))
        session.add(Level(profile_id=profile_id, game_id=game_id, value=6))
        session.commit()

    def answer() -> None:
        item = client.get("/api/items/next", params={"profile_id": profile_id, "game_id": game_id}).json()
        client.post(
            "/api/attempts",
            json={
                "item_id": item["item_id"],
                "profile_id": profile_id,
                "game_id": game_id,
                "telemetry": {"correct": True, "hints_used": 0, "time_ms": 1500},
                "details": {},
            },
        )

    def current_level() -> int:
        with Session(engine) as session:
            return session.exec(
                select(Level).where(Level.profile_id == profile_id, Level.game_id == game_id)
            ).first().value

    for _ in range(3):
        answer()
    assert current_level() == 6
    answer()
    assert current_level() == 7


def test_a_brand_new_older_profiles_first_item_starts_above_level_one(client):
    """PRD §4: age is the base difficulty is calibrated from — an older kid's
    very first item, before any attempt has ever been posted, should already
    reflect their age rather than starting everyone at level 1."""
    profile_id = 2001
    with Session(engine) as session:
        session.add(Profile(id=profile_id, name="Older Kid", avatar="owl", birth_year=2015))  # age 11
        session.commit()

    response = client.get(
        "/api/items/next", params={"profile_id": profile_id, "game_id": "equation_builder"}
    )
    assert response.status_code == 200
    assert response.json()["level"] > 1
