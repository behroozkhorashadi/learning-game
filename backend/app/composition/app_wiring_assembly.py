"""The backend composition root for new-style features. The only place that reads
settings, creates engines and clients, picks implementations, and calls bind_*/make_*.

The legacy app (app/main.py) calls `assemble_features` to mount these routers on
itself, and uses the `LegacyHandles` it returns for the data it still reads during
the migration; `assemble_app` builds a standalone app of just the new-style features
and is what the integration test boots.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Final
from uuid import uuid4

from fastapi import FastAPI
from sqlalchemy import Engine, create_engine
from sqlmodel import Session, col, select

from app.composition.app_settings_assembly import AppSettings
from app.crash_reports.crash_reports_repository_effect import make_file_client_error_log
from app.crash_reports.crash_reports_routes_effect import bind_crash_reports_routes
from app.crash_reports.crash_reports_service_effect import make_crash_reports_service
from app.games._arithmetic import ALL_OPERATORS
from app.games.registry import get_game
from app.models.profile import Profile
from app.pathfinder.pathfinder_repository_effect import SqlPathfinderRepository, make_sql_pathfinder_repository
from app.pathfinder.pathfinder_routes_effect import bind_pathfinder_routes
from app.pathfinder.pathfinder_service_effect import make_pathfinder_service
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
    pathfinder: SqlPathfinderRepository


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

    pathfinder = make_sql_pathfinder_repository(engine=engine)
    pathfinder.create_schema()
    pathfinder_service = make_pathfinder_service(
        repository=pathfinder,
        profile_exists=lambda profile_id: _legacy_profile_exists(engine, profile_id),
        profile_names=lambda profile_ids: _legacy_profile_names(engine, profile_ids),
        clock=utc_now,
    )
    app.include_router(bind_pathfinder_routes(service=pathfinder_service))

    crash_reports = make_crash_reports_service(log=make_file_client_error_log(log_dir=settings.log_dir))
    app.include_router(bind_crash_reports_routes(service=crash_reports))

    return LegacyHandles(practice_configs=practice_configs, pathfinder=pathfinder)


def assemble_app(settings: AppSettings) -> FastAPI:
    app = FastAPI(title="Adaptive Learning Games API")
    assemble_features(app, settings)
    return app


# --- Adapters over legacy modules, until profiles and games migrate (backend/MIGRATION.md) ---


def _legacy_profile_exists(engine: Engine, profile_id: int) -> bool:
    with Session(engine) as session:
        return session.get(Profile, profile_id) is not None


def _legacy_profile_names(engine: Engine, profile_ids: Sequence[int]) -> dict[int, str]:
    with Session(engine) as session:
        rows = session.exec(select(Profile).where(col(Profile.id).in_(profile_ids))).all()
        return {row.id: row.name for row in rows if row.id is not None}


def _legacy_practice_game(game_id: str) -> PracticeGame | None:
    try:
        game = get_game(game_id)
    except KeyError:
        return None
    return PracticeGame(supports_practice_config=game.supports_practice_config(), max_level=game.metadata.max_level)
