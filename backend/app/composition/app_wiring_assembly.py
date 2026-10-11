"""The backend composition root for new-style features. The only place that reads
settings, creates engines and clients, picks implementations, and calls bind_*/make_*.

The legacy app (app/main.py) calls `assemble_features` to mount these routers on
itself, and uses the `LegacyHandles` it returns for the data it still reads during
the migration; `assemble_app` builds a standalone app of just the new-style features
and is what the integration test boots.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Final
from uuid import uuid4

from fastapi import FastAPI
from sqlalchemy import Engine, create_engine
from sqlmodel import Session

from app.composition.app_settings_assembly import AppSettings
from app.games._arithmetic import ALL_OPERATORS
from app.games.registry import get_game
from app.models.profile import Profile
from app.practice.practice_ports_pure import PracticeGame
from app.practice.practice_repository_effect import SqlPracticeConfigRepository, make_sql_practice_config_repository
from app.practice.practice_routes_effect import bind_practice_routes
from app.practice.practice_service_effect import make_practice_service
from app.todo.todo_repository_effect import make_sql_todo_repository
from app.todo.todo_routes_effect import bind_todo_routes
from app.todo.todo_schemas_pure import TodoId
from app.todo.todo_service_effect import make_todo_service

TODO_ROUTE_PREFIX: Final = "/api/examples/todos"


@dataclass(frozen=True)
class LegacyHandles:
    """New-style storage the legacy routes in app/main.py still read until they migrate."""

    practice_configs: SqlPracticeConfigRepository


def utc_now() -> datetime:
    return datetime.now(UTC)


def assemble_engine(settings: AppSettings) -> Engine:
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    return create_engine(settings.database_url, connect_args=connect_args)


def assemble_features(app: FastAPI, settings: AppSettings) -> LegacyHandles:
    engine = assemble_engine(settings)

    if settings.todo_example_enabled:
        todo_repository = make_sql_todo_repository(engine=engine)
        todo_repository.create_schema()
        todo_service = make_todo_service(
            repository=todo_repository,
            clock=utc_now,
            new_id=lambda: TodoId(uuid4().hex),
        )
        app.include_router(bind_todo_routes(service=todo_service), prefix=TODO_ROUTE_PREFIX)

    practice_configs = make_sql_practice_config_repository(engine=engine)
    practice_configs.create_schema()
    practice_service = make_practice_service(
        repository=practice_configs,
        profile_exists=lambda profile_id: _legacy_profile_exists(engine, profile_id),
        games=_legacy_practice_game,
        operators=ALL_OPERATORS,
        clock=utc_now,
    )
    app.include_router(bind_practice_routes(service=practice_service))

    return LegacyHandles(practice_configs=practice_configs)


def assemble_app(settings: AppSettings) -> FastAPI:
    app = FastAPI(title="Adaptive Learning Games API")
    assemble_features(app, settings)
    return app


# --- Adapters over legacy modules, until profiles and games migrate (backend/MIGRATION.md) ---


def _legacy_profile_exists(engine: Engine, profile_id: int) -> bool:
    with Session(engine) as session:
        return session.get(Profile, profile_id) is not None


def _legacy_practice_game(game_id: str) -> PracticeGame | None:
    try:
        game = get_game(game_id)
    except KeyError:
        return None
    return PracticeGame(supports_practice_config=game.supports_practice_config(), max_level=game.metadata.max_level)
