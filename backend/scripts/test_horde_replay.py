"""The replay tool over a small synthetic recording in a temp SQLite file."""

import json
import sqlite3
from pathlib import Path

import pytest

from scripts.horde_replay import main

RECORDING: dict[str, object] = {
    "header": {
        "sessionId": "s",
        "startedAt": "2026-10-11T12:00:00.000Z",
        "seed": 7,
        "weaponId": "starter_blaster",
        "bulletId": "standard_rounds",
        "travelMs": 42000,
        "cover": [
            {"id": "lockers", "kind": "lockers", "x": 3, "depth": 9, "halfWidth": 1, "halfDepth": 0.4, "height": 2.3}
        ],
        "characters": ["scientist_zombie", "hockey_zombie"],
    },
    "snapshots": [
        {
            "t": 0,
            "question": "3 + 4 =",
            "lives": 3,
            "ammo": 0,
            "grenades": 1,
            "shoves": 3,
            "aim": None,
            "zombies": [
                {
                    "slot": 0,
                    "id": "z0",
                    "x": -2,
                    "depth": 12,
                    "heading": 0,
                    "posture": "advancing",
                    "health": 100,
                    "answer": "7",
                    "correct": True,
                    "visibility": "visible",
                },
                {
                    "slot": 1,
                    "id": "z1",
                    "x": 3,
                    "depth": 10,
                    "heading": 0,
                    "posture": "hiding",
                    "health": 50,
                    "answer": "6",
                    "correct": False,
                    "visibility": "hidden",
                },
            ],
            "projectiles": [],
        }
    ],
    "marks": [
        {"t": 0, "type": "question", "text": "3 + 4 =", "summary": "3 + 4 = 7", "answers": ["7", "6"]},
        {"t": 0, "type": "flag", "n": 1},
        {
            "t": 0,
            "type": "shot",
            "mode": "shot",
            "aim": None,
            "via": "click",
            "blockedBy": "lockers",
            "target": None,
            "ignored": False,
        },
    ],
    "flags": 1,
    "outcome": "survived",
    "durationMs": 60000,
}


@pytest.fixture
def db(tmp_path: Path) -> Path:
    path = tmp_path / "replays.db"
    connection = sqlite3.connect(path)
    connection.execute(
        "CREATE TABLE horde_replays (id TEXT, profile_id INTEGER, created_at TEXT, outcome TEXT,"
        " duration_ms INTEGER, flags INTEGER, size_bytes INTEGER, data TEXT)"
    )
    connection.execute(
        "INSERT INTO horde_replays VALUES ('abc', 3, '2026-10-11T12:00:00+00:00', 'survived', 60000, 1, 900, ?)",
        (json.dumps(RECORDING),),
    )
    connection.commit()
    connection.close()
    return path


def test_lists_and_shows_a_flagged_moment_with_a_map(
    db: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["list", "--db", str(db)])
    assert "last    abc  profile 3" in capsys.readouterr().out
    svg = tmp_path / "moment.svg"
    main(["show", "last", "--flag", "1", "--db", str(db), "--svg", str(svg)])
    out = capsys.readouterr().out
    assert "question '3 + 4 ='" in out
    assert "YES" in out
    assert "hidden" in out
    assert "BLOCKED by lockers" in out
    assert svg.read_text().startswith("<svg")


def test_the_timeline_lists_every_mark(db: Path, capsys: pytest.CaptureFixture[str]) -> None:
    main(["timeline", "abc", "--db", str(db)])
    out = capsys.readouterr().out
    assert "QUESTION 3 + 4 =  (slot 0: 7, slot 1: 6)" in out
    assert "*** FLAG 1 ***" in out
