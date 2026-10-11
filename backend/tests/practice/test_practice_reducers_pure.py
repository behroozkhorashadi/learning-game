import pytest

from app.practice.practice_ports_pure import InvalidPracticeConfigError, PracticeGame
from app.practice.practice_reducers_pure import upserted, validate_upsert
from app.practice.practice_schemas_pure import PracticeConfig
from tests.practice.practice_fakes import GAMES, OPERATORS, START, upsert

SUPPORTED = GAMES["fact_fluency"]


def test_accepts_a_valid_upsert() -> None:
    validate_upsert(upsert(operations=["×", "÷"], difficulty=10), game=SUPPORTED, operators=OPERATORS)


@pytest.mark.parametrize(
    ("change", "game", "message"),
    [
        (
            {},
            PracticeGame(supports_practice_config=False, max_level=10),
            "fact_fluency does not support a practice config",
        ),
        ({"operations": []}, SUPPORTED, "operations must not be empty"),
        ({"operations": ["%"]}, SUPPORTED, "operations must be a subset of ('+', '-', '×', '÷')"),
        ({"difficulty": 0}, SUPPORTED, "difficulty must be between 1 and 10"),
        ({"difficulty": 11}, SUPPORTED, "difficulty must be between 1 and 10"),
    ],
)
def test_rejects_with_the_api_message(change: dict[str, object], game: PracticeGame, message: str) -> None:
    with pytest.raises(InvalidPracticeConfigError) as raised:
        validate_upsert(upsert(**change), game=game, operators=OPERATORS)
    assert str(raised.value) == message


def test_new_config_has_no_id_until_stored() -> None:
    config = upserted(None, upsert(focus_numbers={"×": [7, 8]}), now=START)
    assert config.id is None
    assert config.focus_numbers == {"×": [7, 8]}
    assert config.updated_at == START


def test_replacing_keeps_the_existing_id() -> None:
    existing = PracticeConfig(
        id=4, profile_id=1, game_id="fact_fluency", operations=["+"], difficulty=1, updated_at=START
    )
    assert upserted(existing, upsert(difficulty=6), now=START).model_dump(include={"id", "difficulty"}) == {
        "id": 4,
        "difficulty": 6,
    }
