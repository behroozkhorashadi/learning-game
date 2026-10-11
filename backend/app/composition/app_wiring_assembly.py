"""The backend composition root for new-style features. The only place that reads
settings, creates engines and clients, picks implementations, and calls bind_*/make_*.

The legacy app (app/main.py) calls `assemble_features` to mount these routers on
itself, and uses the `LegacyHandles` it returns for the data it still reads during
the migration; `assemble_app` builds a standalone app of just the new-style features
and is what the integration test boots.
"""

import os
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Final
from uuid import uuid4

import httpx
from fastapi import FastAPI
from sqlalchemy import Engine, create_engine

from app.admin.admin_routes_effect import bind_admin_routes
from app.admin.admin_service_effect import make_admin_service
from app.composition.app_settings_assembly import AppSettings
from app.crash_reports.crash_reports_repository_effect import make_file_client_error_log
from app.crash_reports.crash_reports_routes_effect import bind_crash_reports_routes
from app.crash_reports.crash_reports_service_effect import make_crash_reports_service
from app.games._arithmetic import ALL_OPERATORS
from app.games.registry import get_game
from app.pathfinder.pathfinder_repository_effect import SqlPathfinderRepository, make_sql_pathfinder_repository
from app.pathfinder.pathfinder_routes_effect import bind_pathfinder_routes
from app.pathfinder.pathfinder_service_effect import make_pathfinder_service
from app.practice.practice_ports_pure import PracticeGame
from app.practice.practice_repository_effect import SqlPracticeConfigRepository, make_sql_practice_config_repository
from app.practice.practice_routes_effect import bind_practice_routes
from app.practice.practice_service_effect import make_practice_service
from app.profiles.photo_remix_client_effect import make_openai_photo_remixer, make_unavailable_photo_remixer
from app.profiles.photo_remix_service_effect import make_photo_remix_service
from app.profiles.profile_passwords_service_effect import make_scrypt_password_hasher
from app.profiles.profile_photos_repository_effect import make_file_photo_store
from app.profiles.profiles_ports_pure import PhotoRemixer, ProfilesService
from app.profiles.profiles_repository_effect import make_sql_profile_repository
from app.profiles.profiles_routes_effect import bind_profiles_routes
from app.profiles.profiles_schemas_pure import LocalSeedProfile
from app.profiles.profiles_service_effect import make_profiles_service
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
    profiles: ProfilesService
    # Runs at startup: the demo profile, the optional local tester, photo backfill.
    seed_profiles: Callable[[], None]


def utc_now() -> datetime:
    return datetime.now(UTC)


def assemble_engine(settings: AppSettings) -> Engine:
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    return create_engine(settings.database_url, connect_args=connect_args)


def assemble_features(
    app: FastAPI, settings: AppSettings, *, erase_legacy_profile_rows: Callable[[int], None]
) -> LegacyHandles:
    """`erase_legacy_profile_rows` deletes what the unmigrated routes keep for a profile."""
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

    admin = make_admin_service(admin_password=settings.admin_password.get_secret_value())
    app.include_router(bind_admin_routes(service=admin))

    practice_configs = make_sql_practice_config_repository(engine=engine)
    practice_configs.create_schema()
    pathfinder = make_sql_pathfinder_repository(engine=engine)
    pathfinder.create_schema()

    def erase_profile_data(profile_id: int) -> None:
        erase_legacy_profile_rows(profile_id)
        practice_configs.delete_for_profile(profile_id)
        pathfinder.delete_for_profile(profile_id)

    profile_repository = make_sql_profile_repository(engine=engine)
    profile_repository.create_schema()
    profiles = make_profiles_service(
        repository=profile_repository,
        photo_store=make_file_photo_store(
            directory=settings.static_dir / "profile-avatars", new_name=lambda: uuid4().hex
        ),
        hasher=make_scrypt_password_hasher(new_salt=lambda: os.urandom(16)),
        is_admin_password=admin.is_admin_password,
        erase_profile_data=erase_profile_data,
        clock=utc_now,
    )
    remix = make_photo_remix_service(remixer=assemble_photo_remixer(settings))
    app.include_router(bind_profiles_routes(service=profiles, remix=remix))

    practice_service = make_practice_service(
        repository=practice_configs,
        profile_exists=profiles.exists,
        games=_legacy_practice_game,
        operators=ALL_OPERATORS,
        clock=utc_now,
    )
    app.include_router(bind_practice_routes(service=practice_service))

    pathfinder_service = make_pathfinder_service(
        repository=pathfinder,
        profile_exists=profiles.exists,
        profile_names=profiles.names,
        clock=utc_now,
    )
    app.include_router(bind_pathfinder_routes(service=pathfinder_service))

    crash_reports = make_crash_reports_service(log=make_file_client_error_log(log_dir=settings.log_dir))
    app.include_router(bind_crash_reports_routes(service=crash_reports))

    local_seed = (
        LocalSeedProfile(
            name=settings.local_seed_profile_name,
            avatar=settings.local_seed_profile_avatar,
            birth_year=settings.local_seed_profile_birth_year,
        )
        if settings.local_seed_profile_name
        else None
    )
    return LegacyHandles(
        practice_configs=practice_configs,
        pathfinder=pathfinder,
        profiles=profiles,
        seed_profiles=lambda: profiles.seed(local_seed),
    )


def assemble_photo_remixer(settings: AppSettings) -> PhotoRemixer:
    api_key = settings.openai_api_key.get_secret_value() if settings.openai_api_key is not None else ""
    if not api_key:
        return make_unavailable_photo_remixer()
    return make_openai_photo_remixer(
        http=httpx.Client(timeout=120.0),
        api_key=api_key,
        model=settings.openai_image_model,
        size=settings.openai_image_size,
    )


def assemble_app(settings: AppSettings) -> FastAPI:
    app = FastAPI(title="Adaptive Learning Games API")
    assemble_features(app, settings, erase_legacy_profile_rows=lambda _profile_id: None)
    return app


# --- Adapters over legacy modules, until games migrate (backend/MIGRATION.md) ---


def _legacy_practice_game(game_id: str) -> PracticeGame | None:
    try:
        game = get_game(game_id)
    except KeyError:
        return None
    return PracticeGame(supports_practice_config=game.supports_practice_config(), max_level=game.metadata.max_level)
