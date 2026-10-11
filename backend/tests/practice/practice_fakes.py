"""Fakes for the practice feature's injected capabilities."""

from datetime import UTC, datetime, timedelta
from types import MappingProxyType

from app.practice.practice_ports_pure import PracticeGame
from app.practice.practice_schemas_pure import PracticeConfig, PracticeConfigUpsert

START = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)
OPERATORS = ("+", "-", "×", "÷")
GAMES = MappingProxyType(
    {
        "fact_fluency": PracticeGame(supports_practice_config=True, max_level=10),
        "syllable_builder": PracticeGame(supports_practice_config=False, max_level=10),
    }
)


class InMemoryPracticeConfigRepository:
    def __init__(self) -> None:
        self.rows: dict[tuple[int, str], PracticeConfig] = {}
        self.next_id = 1

    def get(self, profile_id: int, game_id: str) -> PracticeConfig | None:
        return self.rows.get((profile_id, game_id))

    def save(self, config: PracticeConfig) -> PracticeConfig:
        stored = config
        if config.id is None:
            stored = config.model_copy(update={"id": self.next_id})
            self.next_id += 1
        self.rows[(config.profile_id, config.game_id)] = stored
        return stored

    def delete(self, profile_id: int, game_id: str) -> None:
        self.rows.pop((profile_id, game_id), None)

    def delete_for_profile(self, profile_id: int) -> None:
        self.rows = {key: row for key, row in self.rows.items() if key[0] != profile_id}


class ManualClock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: int) -> None:
        self.now += timedelta(seconds=seconds)


def known_game(game_id: str) -> PracticeGame | None:
    return GAMES.get(game_id)


def upsert(**overrides: object) -> PracticeConfigUpsert:
    body: dict[str, object] = {
        "profile_id": 1,
        "game_id": "fact_fluency",
        "operations": ["+", "-"],
        "focus_numbers": {},
        "difficulty": 5,
    }
    body.update(overrides)
    return PracticeConfigUpsert.model_validate(body)
