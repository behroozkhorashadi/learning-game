"""The backend composition root. The only place that reads settings, creates engines
and clients, picks implementations, and calls bind_*/make_*.

`assemble_app(settings)` is the whole backend; app/main.py (the uvicorn entry,
`app.main:app`) calls it once with `load_settings()`, and the integration tests boot it
on a temp SQLite file.
"""

import logging
import os
from collections.abc import AsyncGenerator, Callable
from concurrent.futures import Future, ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime
from random import Random
from typing import Final
from uuid import uuid4

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import Engine, create_engine

from app.admin.admin_routes_effect import bind_admin_routes
from app.admin.admin_service_effect import make_admin_service
from app.armory.armory_ports_pure import ArtMaker
from app.armory.armory_repository_effect import make_sql_armory_repository
from app.armory.armory_routes_effect import bind_armory_routes
from app.armory.armory_schemas_pure import ArtPicture
from app.armory.armory_service_effect import make_armory_service
from app.armory.art_files_repository_effect import make_file_art_store
from app.armory.art_studio_routes_effect import bind_art_studio_routes
from app.armory.art_studio_service_effect import make_art_studio_service
from app.armory.looks_routes_effect import bind_looks_routes
from app.armory.looks_service_effect import make_looks_service
from app.badges.badge_art_client_effect import make_no_badge_painter, make_openai_badge_painter
from app.badges.badge_art_files_repository_effect import make_file_badge_art_store
from app.badges.badges_ports_pure import BadgeArt, BadgeNeighbors, BadgesService
from app.badges.badges_repository_effect import make_sql_badge_repository
from app.badges.badges_routes_effect import bind_badges_routes
from app.badges.badges_schemas_pure import Activity, ActivityAttempt, BadgeArtImage
from app.badges.badges_service_effect import make_badges_service
from app.composition.app_settings_assembly import AppSettings
from app.crash_reports.crash_reports_repository_effect import make_file_client_error_log
from app.crash_reports.crash_reports_routes_effect import bind_crash_reports_routes
from app.crash_reports.crash_reports_service_effect import make_crash_reports_service
from app.events.events_repository_effect import SqlEventLog, make_sql_event_log
from app.parents.parents_ports_pure import ParentNeighbors
from app.parents.parents_repository_effect import make_sql_parent_repository
from app.parents.parents_routes_effect import bind_parents_routes
from app.parents.parents_schemas_pure import (
    BadgeEarned,
    GameInfo,
    HistoryAttempt,
    Kid,
    KidHistory,
    LevelChange,
)
from app.parents.parents_service_effect import make_parents_service
from app.pathfinder.pathfinder_repository_effect import SqlPathfinderRepository, make_sql_pathfinder_repository
from app.pathfinder.pathfinder_routes_effect import bind_pathfinder_routes
from app.pathfinder.pathfinder_service_effect import make_pathfinder_service
from app.pieces.illustrations_repository_effect import make_file_illustration_store
from app.pieces.image_generation_client_effect import make_no_image_generator, make_openai_image_generator
from app.pieces.pieces_ports_pure import ImageGenerator, PieceNeighbors, PieceOutputs
from app.pieces.pieces_repository_effect import SqlPieceRepository, make_sql_piece_repository
from app.pieces.pieces_routes_effect import bind_pieces_routes
from app.pieces.pieces_service_effect import make_pieces_service
from app.play.games.arithmetic_reducers_pure import ALL_OPERATORS
from app.play.games.catalog_reducers_pure import game_catalog
from app.play.games.game_module_reducers_pure import GameModule
from app.play.play_ports_pure import PlayNeighbors, PlayService
from app.play.play_repository_effect import SqlPlayRepository, make_sql_play_repository
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
from app.profiles.profiles_ports_pure import PhotoRemixer, ProfileNeighbors
from app.profiles.profiles_repository_effect import make_sql_profile_repository
from app.profiles.profiles_routes_effect import bind_profiles_routes
from app.profiles.profiles_schemas_pure import AvatarImage, LocalSeedProfile, ProfileRead, ProfileRecord
from app.profiles.profiles_service_effect import make_profiles_service
from app.replays.replays_repository_effect import make_sql_replay_repository
from app.replays.replays_routes_effect import bind_replays_routes
from app.replays.replays_service_effect import make_replays_service
from app.todo.todo_repository_effect import make_sql_todo_repository
from app.todo.todo_routes_effect import bind_todo_routes
from app.todo.todo_schemas_pure import TodoId
from app.todo.todo_service_effect import make_todo_service

TODO_ROUTE_PREFIX: Final = "/api/examples/todos"
APP_TITLE: Final = "Adaptive Learning Games API"


def utc_now() -> datetime:
    return datetime.now(UTC)


def local_time(moment: datetime) -> datetime:
    """A stored (naive UTC) moment on this machine's clock (the family's)."""
    return (moment if moment.tzinfo is not None else moment.replace(tzinfo=UTC)).astimezone()


def local_day(moment: datetime) -> date:
    """The day on this machine's calendar (the family's): stored times are naive UTC."""
    return local_time(moment).date()


def assemble_engine(settings: AppSettings) -> Engine:
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    return create_engine(settings.database_url, connect_args=connect_args)


def assemble_app(settings: AppSettings) -> FastAPI:
    """The whole backend. Tables are created here, at assembly; startup seeds the demo
    profile (and the optional local tester) and the badges."""
    seeds: list[Callable[[], None]] = []

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        for seed in seeds:
            seed()
        yield

    app = FastAPI(title=APP_TITLE, lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    settings.static_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(settings.static_dir)), name="static")
    seeds.extend(assemble_features(app, settings))
    return app


def assemble_features(app: FastAPI, settings: AppSettings) -> tuple[Callable[[], None], ...]:
    """Mounts every feature's routes on `app`; returns the startup seeds."""
    engine = assemble_engine(settings)
    assemble_todo_example(app, settings, engine)

    admin = make_admin_service(admin_password=settings.admin_password.get_secret_value())
    app.include_router(bind_admin_routes(service=admin))

    events = make_sql_event_log(engine=engine, clock=utc_now, new_id=lambda: str(uuid4()))
    practice_configs = make_sql_practice_config_repository(engine=engine)
    pathfinder = make_sql_pathfinder_repository(engine=engine)
    play_repository = make_sql_play_repository(engine=engine)
    badge_repository = make_sql_badge_repository(engine=engine)
    piece_repository = make_sql_piece_repository(engine=engine)
    profile_repository = make_sql_profile_repository(engine=engine)
    armory_repository = make_sql_armory_repository(engine=engine)
    replay_repository = make_sql_replay_repository(engine=engine)
    parent_repository = make_sql_parent_repository(engine=engine)
    for create_schema in (
        events.create_schema,
        practice_configs.create_schema,
        pathfinder.create_schema,
        play_repository.create_schema,
        badge_repository.create_schema,
        piece_repository.create_schema,
        profile_repository.create_schema,
        armory_repository.create_schema,
        replay_repository.create_schema,
        parent_repository.create_schema,
    ):
        create_schema()

    def erase_profile_data(profile_id: int) -> None:
        for delete_for_profile in (
            piece_repository.delete_for_profile,
            play_repository.delete_for_profile,
            badge_repository.delete_for_profile,
            events.delete_for_profile,
            practice_configs.delete_for_profile,
            pathfinder.delete_for_profile,
            armory_repository.delete_for_profile,
            replay_repository.delete_for_profile,
        ):
            delete_for_profile(profile_id)

    hasher = make_scrypt_password_hasher(new_salt=lambda: os.urandom(16))
    profiles = make_profiles_service(
        repository=profile_repository,
        photo_store=make_file_photo_store(
            directory=settings.static_dir / "profile-avatars", new_name=lambda: uuid4().hex
        ),
        hasher=hasher,
        neighbors=ProfileNeighbors(
            is_admin_password=admin.is_admin_password,
            erase_profile_data=erase_profile_data,
            parent_exists=lambda parent_id: parent_repository.get(parent_id) is not None,
        ),
        clock=utc_now,
    )
    remix = make_photo_remix_service(remixer=assemble_photo_remixer(settings))
    app.include_router(bind_profiles_routes(service=profiles, remix=remix))

    catalog = game_catalog()
    badges = make_badges_service(
        repository=badge_repository,
        events=events,
        neighbors=BadgeNeighbors(
            activity=lambda profile_id: activity_of(play_repository, piece_repository, events, profile_id),
            profile_exists=profiles.exists,
            game_title=lambda game_id: catalog[game_id].metadata.title if game_id in catalog else None,
            mascot=lambda profile_id: avatar_mascot(profile_repository.get(profile_id)),
        ),
        art=assemble_badge_art(settings),
        clock=utc_now,
        local_day=local_day,
    )
    app.include_router(bind_badges_routes(service=badges))

    parents = make_parents_service(
        repository=parent_repository,
        hasher=hasher,
        neighbors=ParentNeighbors(
            kids_of=lambda parent_id: tuple(kid_of(p) for p in profiles.kids_of(parent_id)),
            history=lambda profile_id: kid_history(play_repository, events, badges, pathfinder, profile_id),
            unlink_kids=profiles.unlink_parent,
            games={game_id: game_info(game) for game_id, game in catalog.items()},
            is_admin_password=admin.is_admin_password,
        ),
        clock=utc_now,
        local_time=local_time,
    )
    app.include_router(bind_parents_routes(service=parents))

    def award_badges(profile_id: int, session_id: str | None) -> None:
        badges.evaluate(profile_id, session_id)

    play = make_play_service(
        repository=play_repository,
        events=events,
        games=catalog,
        neighbors=PlayNeighbors(
            birth_year=profiles.birth_year,
            practice_settings=lambda profile_id, game_id: practice_settings(practice_configs, profile_id, game_id),
            after_attempt=award_badges,
        ),
        clock=utc_now,
        new_rng=Random,
    )
    app.include_router(bind_play_routes(service=play))

    pieces = make_pieces_service(
        repository=piece_repository,
        events=events,
        outputs=PieceOutputs(
            images=assemble_image_generator(settings),
            store=make_file_illustration_store(
                directory=settings.static_dir / "illustrations", new_name=lambda: uuid4().hex
            ),
        ),
        neighbors=PieceNeighbors(profile_exists=profiles.exists, after_piece=award_badges),
        clock=utc_now,
        new_id=lambda: str(uuid4()),
    )
    app.include_router(bind_pieces_routes(service=pieces))

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

    armory = make_armory_service(repository=armory_repository, profile_exists=profiles.exists, clock=utc_now)
    app.include_router(bind_armory_routes(service=armory))
    art_studio = make_art_studio_service(
        repository=armory_repository,
        profile_exists=profiles.exists,
        art_maker=assemble_art_maker(settings),
        art_store=make_file_art_store(directory=settings.static_dir / "armory-art", new_name=lambda: uuid4().hex),
        clock=utc_now,
        new_id=lambda: uuid4().hex,
    )
    app.include_router(bind_art_studio_routes(service=art_studio))
    looks = make_looks_service(repository=armory_repository, profile_exists=profiles.exists)
    app.include_router(bind_looks_routes(service=looks))
    replays = make_replays_service(
        repository=replay_repository, profile_exists=profiles.exists, clock=utc_now, new_id=lambda: uuid4().hex
    )
    app.include_router(bind_replays_routes(service=replays))

    crash_reports = make_crash_reports_service(log=make_file_client_error_log(log_dir=settings.log_dir))
    app.include_router(bind_crash_reports_routes(service=crash_reports))

    local_seed = assemble_local_seed(settings)
    return (lambda: profiles.seed(local_seed), badges.seed)


def assemble_todo_example(app: FastAPI, settings: AppSettings, engine: Engine) -> None:
    if not settings.todo_example_enabled:
        return
    todo_repository = make_sql_todo_repository(engine=engine)
    todo_repository.create_schema()
    todo_service = make_todo_service(repository=todo_repository, clock=utc_now, new_id=lambda: TodoId(uuid4().hex))
    app.include_router(bind_todo_routes(service=todo_service), prefix=TODO_ROUTE_PREFIX)


def _openai_key(settings: AppSettings) -> str:
    return settings.openai_api_key.get_secret_value() if settings.openai_api_key is not None else ""


def assemble_photo_remixer(settings: AppSettings) -> PhotoRemixer:
    api_key = _openai_key(settings)
    if not api_key:
        return make_unavailable_photo_remixer()
    return make_openai_photo_remixer(
        http=httpx.Client(timeout=120.0),
        api_key=api_key,
        model=settings.openai_image_model,
        size=settings.openai_image_size,
    )


def assemble_art_maker(settings: AppSettings) -> ArtMaker:
    """The art studio's AI: the same OpenAI image edits as the profile photo remix,
    translated between the two features' picture types."""
    remixer = assemble_photo_remixer(settings)

    def generate_art(picture: ArtPicture, prompt: str) -> ArtPicture | None:
        made = remixer(AvatarImage(content=picture.content, content_type=picture.content_type), prompt)
        return None if made is None else ArtPicture(content=made.content, content_type=made.content_type)

    return generate_art


def assemble_badge_art(settings: AppSettings) -> BadgeArt:
    """Badge art paints on a small worker pool, so earning a badge never waits on it."""
    api_key = _openai_key(settings)
    painter: Callable[[str], BadgeArtImage | None] = (
        make_no_badge_painter()
        if settings.image_provider == "none" or not api_key
        else make_openai_badge_painter(
            http=httpx.Client(timeout=120.0),
            api_key=api_key,
            model=settings.openai_image_model,
            quality=settings.openai_badge_image_quality,
        )
    )
    workers = ThreadPoolExecutor(max_workers=2, thread_name_prefix="badge-art")

    def run_later(job: Callable[[], None]) -> None:
        workers.submit(job).add_done_callback(log_failure)

    return BadgeArt(
        paint=painter,
        store=make_file_badge_art_store(directory=settings.static_dir / "badge-art", new_name=lambda: uuid4().hex),
        run_later=run_later,
    )


def log_failure(job: Future[None]) -> None:
    error = job.exception()
    if error is not None:
        logging.getLogger("app.badges.art").error("badge art job failed", exc_info=error)


def assemble_image_generator(settings: AppSettings) -> ImageGenerator:
    api_key = _openai_key(settings)
    if settings.image_provider == "none" or not api_key:
        return make_no_image_generator()
    return make_openai_image_generator(
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


def avatar_mascot(profile: ProfileRecord | None) -> str | None:
    """A word avatar ("fox") is a mascot for badge art; a photo path is not sent."""
    if profile is None or not profile.avatar.isalpha():
        return None
    return profile.avatar


def activity_of(play: SqlPlayRepository, pieces: SqlPieceRepository, events: SqlEventLog, profile_id: int) -> Activity:
    return Activity(
        attempts=tuple(
            ActivityAttempt(game_id=a.game_id, correct=a.correct, time_ms=a.time_ms, created_at=a.created_at)
            for a in play.attempts_for_profile(profile_id)
        ),
        piece_game_ids=pieces.game_ids_for(profile_id),
        rating_values=play.rating_values(profile_id),
        event_timestamps=events.timestamps(profile_id),
    )


def kid_of(profile: ProfileRead) -> Kid:
    return Kid(profile_id=profile.id or 0, name=profile.name, avatar=profile.avatar, birth_year=profile.birth_year)


def game_info(game: GameModule) -> GameInfo:
    meta = game.metadata
    return GameInfo(
        game_id=meta.id, title=meta.title, icon=meta.icon, max_level=meta.max_level, skill_ids=tuple(meta.skill_ids)
    )


# What a parent's report counts as the kid doing something (badges, ratings, and
# verifications happen around play, not as play).
PLAY_EVENT_TYPES: Final = ("item_shown", "attempt", "difficulty_changed", "piece_created", "piece_revised")


def kid_history(
    play: SqlPlayRepository,
    events: SqlEventLog,
    badges: BadgesService,
    pathfinder: SqlPathfinderRepository,
    profile_id: int,
) -> KidHistory:
    played = events.for_profile(profile_id, PLAY_EVENT_TYPES)
    return KidHistory(
        attempts=tuple(
            HistoryAttempt(
                game_id=a.game_id,
                item_id=a.item_id,
                level=a.level,
                correct=a.correct,
                hints_used=a.hints_used,
                time_ms=a.time_ms,
                details=a.details,
                created_at=a.created_at,
            )
            for a in play.attempts_for_profile(profile_id)
        ),
        shown_items=tuple(e.payload for e in played if e.event_type.value == "item_shown"),
        actions=tuple((e.timestamp, e.game_id) for e in played),
        level_changes=tuple(
            level_change(e.game_id, e.timestamp, e.payload)
            for e in played
            if e.event_type.value == "difficulty_changed"
        ),
        ratings=play.ratings_for(profile_id),
        badges=tuple(
            BadgeEarned(name=b.name, tier=b.tier, awarded_at=b.awarded_at)
            for b in badges.badges_for(profile_id)
            if b.earned and b.awarded_at is not None
        ),
        pathfinder_completions=pathfinder.completion_times(profile_id),
    )


def level_change(game_id: str, at: datetime, payload: dict[str, object]) -> LevelChange:
    before, after = payload.get("from"), payload.get("to")
    return LevelChange(
        game_id=game_id,
        at=at,
        before=before if isinstance(before, int) else 0,
        after=after if isinstance(after, int) else 0,
    )
