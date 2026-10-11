"""Practice-config orchestration: checks the profile and game through injected lookups,
applies the pure rules, and reads/writes through the repository."""

from collections.abc import Sequence

from app.practice.practice_ports_pure import (
    Clock,
    PracticeConfigNotFoundError,
    PracticeConfigRepository,
    PracticeGames,
    PracticeService,
    ProfileExists,
    ProfileNotFoundError,
    UnknownGameError,
)
from app.practice.practice_reducers_pure import upserted, validate_upsert
from app.practice.practice_schemas_pure import PracticeConfig, PracticeConfigUpsert


def make_practice_service(
    *,
    repository: PracticeConfigRepository,
    profile_exists: ProfileExists,
    games: PracticeGames,
    operators: Sequence[str],
    clock: Clock,
) -> PracticeService:
    def get_config(profile_id: int, game_id: str) -> PracticeConfig:
        config = repository.get(profile_id, game_id)
        if config is None:
            raise PracticeConfigNotFoundError
        return config

    def put_config(upsert: PracticeConfigUpsert) -> PracticeConfig:
        if not profile_exists(upsert.profile_id):
            raise ProfileNotFoundError(upsert.profile_id)
        game = games(upsert.game_id)
        if game is None:
            raise UnknownGameError(upsert.game_id)
        validate_upsert(upsert, game=game, operators=operators)
        existing = repository.get(upsert.profile_id, upsert.game_id)
        return repository.save(upserted(existing, upsert, now=clock()))

    def delete_config(profile_id: int, game_id: str) -> None:
        get_config(profile_id, game_id)
        repository.delete(profile_id, game_id)

    return PracticeService(get_config=get_config, put_config=put_config, delete_config=delete_config)
