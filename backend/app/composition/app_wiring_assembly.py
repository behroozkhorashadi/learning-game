"""The backend composition root for new-style features. The only place that reads
settings, creates engines and clients, picks implementations, and calls bind_*/make_*.

The legacy app (app/main.py) calls `assemble_features` to mount these routers on
itself, and uses the `LegacyHandles` it returns for what its remaining routes still
need during the migration; `assemble_app` builds a standalone app of just the
new-style features and is what the integration test boots.
"""

import os
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from random import Random
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
from app.events.events_repository_effect import make_sql_event_log
from app.pathfinder.pathfinder_repository_effect import make_sql_pathfinder_repository
from app.pathfinder.pathfinder_routes_effect import bind_pathfinder_routes
from app.pathfinder.pathfinder_service_effect import make_pathfinder_service
from app.play.games.arithmetic_reducers_pure import ALL_OPERATORS
from app.play.games.catalog_reducers_pure import game_catalog
from app.play.play_ports_pure import PlayNeighbors, PlayService
from app.play.play_repository_effect import make_sql_play_repository
from app.play.play_routes_effect import bind_play_routes
from app.play.play_schemas_pure import PracticeSettings
from app.play.play_service_effect import make_play_service
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
    """What the legacy routes in app/main.py still use until they migrate."""

    profiles: ProfilesService
    play: PlayService
    # Runs at startup: the demo profile, the optional local tester, photo backfill.
    seed_profiles: Callable[[], None]


def utc_now() -> datetime:
    return datetime.now(UTC)


def assemble_engine(settings: AppSettings) -> Engine:
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    return create_engine(settings.database_url, connect_args=connect_args)


def assemble_features(
    app: FastAPI,
    settings: AppSettings,
    *,
    erase_legacy_profile_rows: Callable[[int], None],
    after_attempt: Callable[[int, str | None], None],
) -> LegacyHandles:
    """`erase_legacy_profile_rows` deletes what the unmigrated routes keep for a profile;
    `after_attempt` awards badges (still legacy)."""
    engine = assemble_engine(settings)
    assemble_todo_example(app, settings, engine)

    admin = make_admin_service(admin_password=settings.admin_password.get_secret_value())
    app.include_router(bind_admin_routes(service=admin))

    events = make_sql_event_log(engine=engine, clock=utc_now, new_id=lambda: str(uuid4()))
    events.create_schema()
    practice_configs = make_sql_practice_config_repository(engine=engine)
    practice_configs.create_schema()
    pathfinder = make_sql_pathfinder_repository(engine=engine)
    pathfinder.create_schema()
    play_repository = make_sql_play_repository(engine=engine)
    play_repository.create_schema()

    def erase_profile_data(profile_id: int) -> None:
        erase_legacy_profile_rows(profile_id)
        play_repository.delete_for_profile(profile_id)
        events.delete_for_profile(profile_id)
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

    play = make_play_service(
        repository=play_repository,
        events=events,
        games=game_catalog(),
        neighbors=PlayNeighbors(
            birth_year=profiles.birth_year,
            practice_settings=lambda profile_id, game_id: practice_settings(practice_configs, profile_id, game_id),
            after_attempt=after_attempt,
        ),
        clock=utc_now,
        new_rng=Random,
    )
    app.include_router(bind_play_routes(service=play))

    practice_service = make_practice_service(
        repository=practice_configs,
        profile_exists=profiles.exists,
        games=lambda game_id: practice_game(play, game_id),
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

    local_seed = assemble_local_seed(settings)
    return LegacyHandles(profiles=profiles, play=play, seed_profiles=lambda: profiles.seed(local_seed))


def assemble_todo_example(app: FastAPI, settings: AppSettings, engine: Engine) -> None:
    if not settings.todo_example_enabled:
        return
    todo_repository = make_sql_todo_repository(engine=engine)
    todo_repository.create_schema()
    todo_service = make_todo_service(repository=todo_repository, clock=utc_now, new_id=lambda: TodoId(uuid4().hex))
    app.include_router(bind_todo_routes(service=todo_service), prefix=TODO_ROUTE_PREFIX)


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


def assemble_local_seed(settings: AppSettings) -> LocalSeedProfile | None:
    if not settings.local_seed_profile_name:
        return None
    return LocalSeedProfile(
        name=settings.local_seed_profile_name,
        avatar=settings.local_seed_profile_avatar,
        birth_year=settings.local_seed_profile_birth_year,
    )


def assemble_app(settings: AppSettings) -> FastAPI:
    app = FastAPI(title="Adaptive Learning Games API")
    assemble_features(
        app,
        settings,
        erase_legacy_profile_rows=lambda _profile_id: None,
        after_attempt=lambda _profile_id, _session_id: None,
    )
    return app


# --- Translations between features' own types (features never import each other) ---


def practice_settings(configs: SqlPracticeConfigRepository, profile_id: int, game_id: str) -> PracticeSettings | None:
    config = configs.get(profile_id, game_id)
    if config is None:
        return None
    return PracticeSettings(
        difficulty=config.difficulty, operations=tuple(config.operations), focus_numbers=dict(config.focus_numbers)
    )


def practice_game(play: PlayService, game_id: str) -> PracticeGame | None:
    rules = play.game_rules(game_id)
    if rules is None:
        return None
    return PracticeGame(supports_practice_config=rules.supports_practice_config, max_level=rules.max_level)
