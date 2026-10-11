"""Pure practice-config rules: validate an upsert, then fold it into the stored row.
The clock reading and the game's rules arrive as arguments."""

from collections.abc import Sequence
from datetime import datetime

from app.practice.practice_ports_pure import InvalidPracticeConfigError, PracticeGame
from app.practice.practice_schemas_pure import PracticeConfig, PracticeConfigUpsert


def validate_upsert(upsert: PracticeConfigUpsert, *, game: PracticeGame, operators: Sequence[str]) -> None:
    """Raises InvalidPracticeConfigError (a 422) with the message the API returns."""
    if not game.supports_practice_config:
        msg = f"{upsert.game_id} does not support a practice config"
        raise InvalidPracticeConfigError(msg)
    if not upsert.operations:
        msg = "operations must not be empty"
        raise InvalidPracticeConfigError(msg)
    if not set(upsert.operations) <= set(operators):
        msg = f"operations must be a subset of {tuple(operators)}"
        raise InvalidPracticeConfigError(msg)
    if not 1 <= upsert.difficulty <= game.max_level:
        msg = f"difficulty must be between 1 and {game.max_level}"
        raise InvalidPracticeConfigError(msg)


def upserted(existing: PracticeConfig | None, upsert: PracticeConfigUpsert, *, now: datetime) -> PracticeConfig:
    """The row after a PUT: the existing one (keeping its id) or a new one, with the new values."""
    return PracticeConfig(
        id=None if existing is None else existing.id,
        profile_id=upsert.profile_id,
        game_id=upsert.game_id,
        operations=list(upsert.operations),
        focus_numbers=dict(upsert.focus_numbers),
        difficulty=upsert.difficulty,
        updated_at=now,
    )
