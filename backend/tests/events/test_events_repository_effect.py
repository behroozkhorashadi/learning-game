from pathlib import Path

import pytest
from sqlalchemy import inspect, text

from tests.events.events_fakes import START, event_log


def test_keeps_the_existing_table_and_stores_types_by_name(tmp_path: Path) -> None:
    log = event_log(tmp_path)
    assert inspect(log.engine).get_table_names() == ["event"]
    event_id = log.append(
        profile_id=1, game_id="g", event_type="item_shown", payload={"a": 1}, variant_id=None, session_id="s"
    )
    assert event_id == "event-1"
    with log.engine.connect() as connection:
        assert connection.execute(text("SELECT event_type FROM event")).scalar_one() == "ITEM_SHOWN"


def test_unknown_event_types_are_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="made_up"):
        event_log(tmp_path).append(
            profile_id=1, game_id="g", event_type="made_up", payload={}, variant_id=None, session_id=None
        )


def test_session_payloads_latest_and_timestamps(tmp_path: Path) -> None:
    log = event_log(tmp_path)

    def add(event_type: str, payload: dict[str, object], *, session_id: str | None = "s", profile_id: int = 1) -> None:
        log.append(
            profile_id=profile_id,
            game_id="g",
            event_type=event_type,
            payload=payload,
            variant_id=None,
            session_id=session_id,
        )

    add("item_shown", {"n": 1})
    add("difficulty_changed", {"needs_confidence_item": True})
    add("item_shown", {"n": 2}, session_id="other")
    add("attempt", {"n": 3})
    add("item_shown", {"n": 4}, profile_id=2)

    assert log.payloads(profile_id=1, game_id="g", session_id="s", event_type="item_shown") == ({"n": 1},)
    assert log.latest(profile_id=1, game_id="g", event_types=("difficulty_changed", "item_shown")) == (
        "item_shown",
        {"n": 2},
    )
    assert log.latest(profile_id=3, game_id="g", event_types=("item_shown",)) is None
    assert len(log.timestamps(1)) == 4
    assert min(log.timestamps(1)) == START.replace(tzinfo=None)

    log.delete_for_profile(1)
    assert log.timestamps(1) == ()
    assert len(log.timestamps(2)) == 1
