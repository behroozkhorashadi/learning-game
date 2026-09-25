"""FastAPI app — PRD §9, §16 step 3.

- GET  /api/profiles     : read-only listing for the profile-picker screen.
- POST /api/profiles     : backs the create-profile screen.
- PATCH/DELETE /api/profiles/{id}: backs the admin screen's edit/remove
  actions. Gated by `require_admin` (app/admin_auth.py) — a hardcoded shared
  password, not real auth (PRD §2 non-goals).
- POST /api/admin/login  : lets the admin screen check the password before
  showing itself. Holds no session state — see `app/admin_auth.py`.
- GET  /api/items/next   : server selects the level, generates an Item, logs `item_shown`.
- POST /api/attempts     : validates the telemetry core, persists the Attempt, logs `attempt`.
- POST /api/ratings      : persists an explicit kid-provided rating, logs `rating_given`.
- POST /api/verifications: persists a parent's PIN-gated write-out check, logs `verification_completed`.
- GET  /api/profiles/{id}/badges, /stats: the Accomplishments screen's badge list and
  live-derived stats read-model.
- POST /api/pieces, GET /api/pieces, GET/PATCH/DELETE /api/pieces/{id}: the writing-layer's
  saved-story record (HANDOFF.md §4).
- POST /api/pieces/{id}/illustrations, /revisions, /remixes, /turns: a piece's
  child records — generated art, coach revision passes, Style Remix Lab
  versions, and Tag-Team Story turns, respectively.
- GET/PUT/DELETE /api/practice-config: a parent's per-(profile, game)
  operations/focus-numbers/difficulty override for games that support it
  (see `app/models/practice_config.py`, `GameModule.supports_practice_config`).
  No auth — a practice preference, not a destructive action.
- POST /api/client-errors: fire-and-forget sink for uncaught frontend errors
  (React error boundary, window error/unhandledrejection) — see
  `app/services/client_error_log.py`. Written to `logs/client_errors.log`.

No accounts/auth (PRD §2 non-goals) beyond the admin screen's hardcoded
password gate. A demo profile is always seeded on startup so there's
something to point the frontend and curl at; a second, real named tester
profile can be seeded locally via LOCAL_SEED_PROFILE_* env vars (see
backend/.env.example) without that person's name/photo living in the repo.
"""

import os
from contextlib import asynccontextmanager
from random import Random
from typing import AsyncIterator, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

import app.games  # noqa: F401  (populates the game registry on import)
from app.admin_auth import AdminLoginRequest, require_admin, verify_admin_password
from app.games._arithmetic import ALL_OPERATORS
from app.db import create_db_and_tables, engine, get_session
from app.engine.level_selector import get_current_level
from app.events.log import append_event
from app.games.registry import all_games, get_game
from app.util import utcnow
from app.models.attempt import Attempt, AttemptCreate, AttemptRead
from app.models.badge import Badge, BadgeAward, BadgeStatus
from app.models.enums import EventType
from app.models.event import Event
from app.models.game import GameMetadata, Level
from app.models.item import Item
from app.models.piece import (
    Illustration,
    IllustrationCreate,
    IllustrationGenerateRequest,
    Piece,
    PieceCreate,
    PieceUpdate,
    RemixVersion,
    RemixVersionCreate,
    RevisionPass,
    RevisionPassCreate,
    TurnLine,
    TurnLineCreate,
)
from app.models.practice_config import PracticeConfig, PracticeConfigUpsert
from app.models.profile import AVATAR_OPTIONS, MAX_AGE, MIN_AGE, Profile, ProfileCreate, ProfileUpdate, SkillState
from app.models.rating import Rating, RatingCreate
from app.models.session import PlaySession
from app.models.stats import ProfileStats
from app.models.verification import Verification, VerificationCreate
from app.services.badges_service import compute_profile_stats, evaluate_and_award_badges, seed_badges
from app.services.client_error_log import ClientErrorReport, log_client_error
from app.services.image_generation import STATIC_DIR, ImageGenerator, get_image_generator, save_generated_image
from app.services.loop_a_service import choose_next_item_level, process_attempt


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    create_db_and_tables()
    with Session(engine) as session:
        _seed_test_profiles(session)
        seed_badges(session)
    yield


app = FastAPI(title="Adaptive Learning Games API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def _seed_test_profiles(session: Session) -> None:
    if session.get(Profile, 1) is None:
        session.add(Profile(id=1, name="Demo Kid", avatar="fox", birth_year=2020))
    _seed_local_profile(session)
    session.commit()


def _seed_local_profile(session: Session) -> None:
    """Optional second seed profile for a real named tester, kept out of the
    repo (see backend/.env.example) — id=2 is stable so their attempts/badges/
    session history persist across restarts instead of being re-seeded from
    scratch. Only set on machines that opt in via LOCAL_SEED_PROFILE_* env vars."""
    name = os.environ.get("LOCAL_SEED_PROFILE_NAME")
    if not name or session.get(Profile, 2) is not None:
        return
    avatar = os.environ.get("LOCAL_SEED_PROFILE_AVATAR", "fox")
    birth_year = int(os.environ.get("LOCAL_SEED_PROFILE_BIRTH_YEAR", "2019"))
    session.add(Profile(id=2, name=name, avatar=avatar, birth_year=birth_year))


@app.get("/api/profiles", response_model=list[Profile])
def list_profiles(session: Session = Depends(get_session)) -> list[Profile]:
    """Read-only listing for the profile-picker screen. No auth (PRD §2 non-goals)."""
    return list(session.exec(select(Profile)).all())


def _validated_profile_name(name: str) -> str:
    name = name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name must not be blank")
    return name


def _validate_profile_avatar(avatar: str) -> None:
    if avatar not in AVATAR_OPTIONS:
        raise HTTPException(status_code=422, detail=f"avatar must be one of {AVATAR_OPTIONS}")


def _validate_profile_birth_year(birth_year: int) -> None:
    age = utcnow().year - birth_year
    if age < MIN_AGE or age > MAX_AGE:
        raise HTTPException(status_code=422, detail=f"birth_year implies an age outside {MIN_AGE}-{MAX_AGE}")


@app.post("/api/profiles", response_model=Profile, status_code=201)
def post_profile(payload: ProfileCreate, session: Session = Depends(get_session)) -> Profile:
    """Backs the create-profile screen. No auth (PRD §2 non-goals) — anyone on
    the LAN can add a player, same trust model as everything else here."""
    name = _validated_profile_name(payload.name)
    _validate_profile_avatar(payload.avatar)
    _validate_profile_birth_year(payload.birth_year)

    profile = Profile(name=name, avatar=payload.avatar, birth_year=payload.birth_year, reading_support=payload.reading_support)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@app.post("/api/admin/login", status_code=204)
def admin_login(payload: AdminLoginRequest) -> None:
    """Lets the admin screen check a password before showing itself — a UX
    nicety, not the actual gate. `require_admin` (checked per-request on the
    admin-only endpoints below) is what actually protects anything; this
    endpoint holds no session state of its own."""
    verify_admin_password(payload.password)


@app.patch("/api/profiles/{profile_id}", response_model=Profile, dependencies=[Depends(require_admin)])
def patch_profile(profile_id: int, payload: ProfileUpdate, session: Session = Depends(get_session)) -> Profile:
    """Admin-only (see `app/admin_auth.py`) — backs the edit-profile screen."""
    profile = session.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"no profile with id {profile_id}")

    if payload.name is not None:
        profile.name = _validated_profile_name(payload.name)
    if payload.avatar is not None:
        _validate_profile_avatar(payload.avatar)
        profile.avatar = payload.avatar
    if payload.birth_year is not None:
        _validate_profile_birth_year(payload.birth_year)
        profile.birth_year = payload.birth_year
    if payload.reading_support is not None:
        profile.reading_support = payload.reading_support

    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@app.delete("/api/profiles/{profile_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_profile(profile_id: int, session: Session = Depends(get_session)) -> None:
    """Admin-only (see `app/admin_auth.py`) — backs the admin screen's remove
    action. Removes every row that hangs off this profile first since
    there's no DB-level cascade configured (same reasoning as `delete_piece`)."""
    profile = session.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"no profile with id {profile_id}")

    piece_ids = [p.id for p in session.exec(select(Piece).where(Piece.profile_id == profile_id)).all()]
    for model in (Illustration, RevisionPass, RemixVersion, TurnLine):
        for row in session.exec(select(model).where(model.piece_id.in_(piece_ids))).all():
            session.delete(row)
    for piece_id in piece_ids:
        piece = session.get(Piece, piece_id)
        if piece is not None:
            session.delete(piece)

    attempt_ids = [a.id for a in session.exec(select(Attempt).where(Attempt.profile_id == profile_id)).all()]
    for verification in session.exec(select(Verification).where(Verification.attempt_id.in_(attempt_ids))).all():
        session.delete(verification)

    for model in (Attempt, Event, Rating, BadgeAward, Level, PlaySession, SkillState, PracticeConfig):
        for row in session.exec(select(model).where(model.profile_id == profile_id)).all():
            session.delete(row)

    session.delete(profile)
    session.commit()


def _get_practice_config(session: Session, profile_id: int, game_id: str) -> Optional[PracticeConfig]:
    return session.exec(
        select(PracticeConfig).where(PracticeConfig.profile_id == profile_id, PracticeConfig.game_id == game_id)
    ).first()


@app.get("/api/practice-config", response_model=PracticeConfig)
def get_practice_config(profile_id: int, game_id: str, session: Session = Depends(get_session)) -> PracticeConfig:
    """Backs the practice-settings screen (e.g. Equation Outbreak's focus
    picker). 404 means "no config yet — this game is on automatic
    difficulty," not an error."""
    config = _get_practice_config(session, profile_id, game_id)
    if config is None:
        raise HTTPException(status_code=404, detail="no practice config set for this profile/game")
    return config


@app.put("/api/practice-config", response_model=PracticeConfig)
def put_practice_config(payload: PracticeConfigUpsert, session: Session = Depends(get_session)) -> PracticeConfig:
    """Creates or replaces the (profile_id, game_id) config — no auth (PRD §2
    non-goals): this is a practice preference, not a destructive action, so
    it doesn't need the admin screen's password gate."""
    if session.get(Profile, payload.profile_id) is None:
        raise HTTPException(status_code=404, detail=f"no profile with id {payload.profile_id}")
    try:
        game = get_game(payload.game_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not game.supports_practice_config():
        raise HTTPException(status_code=422, detail=f"{payload.game_id} does not support a practice config")

    if not payload.operations:
        raise HTTPException(status_code=422, detail="operations must not be empty")
    if not set(payload.operations) <= set(ALL_OPERATORS):
        raise HTTPException(status_code=422, detail=f"operations must be a subset of {ALL_OPERATORS}")
    if not (1 <= payload.difficulty <= game.metadata.max_level):
        raise HTTPException(status_code=422, detail=f"difficulty must be between 1 and {game.metadata.max_level}")

    config = _get_practice_config(session, payload.profile_id, payload.game_id)
    if config is None:
        config = PracticeConfig(profile_id=payload.profile_id, game_id=payload.game_id, operations=[], difficulty=1)
    config.operations = payload.operations
    config.focus_numbers = payload.focus_numbers
    config.difficulty = payload.difficulty
    config.updated_at = utcnow()
    session.add(config)
    session.commit()
    session.refresh(config)
    return config


@app.delete("/api/practice-config", status_code=204)
def delete_practice_config(profile_id: int, game_id: str, session: Session = Depends(get_session)) -> None:
    """Reverts this profile/game to the server-adaptive Level."""
    config = _get_practice_config(session, profile_id, game_id)
    if config is None:
        raise HTTPException(status_code=404, detail="no practice config set for this profile/game")
    session.delete(config)
    session.commit()


@app.get("/api/profiles/{profile_id}/badges", response_model=list[BadgeStatus])
def get_profile_badges(profile_id: int, session: Session = Depends(get_session)) -> list[BadgeStatus]:
    """Backs the Accomplishments screen's badge shelf — every seeded badge,
    annotated with whether (and when) this profile earned it."""
    if session.get(Profile, profile_id) is None:
        raise HTTPException(status_code=404, detail=f"no profile with id {profile_id}")

    badges = list(session.exec(select(Badge).order_by(Badge.id)).all())
    awards_by_badge_id = {
        a.badge_id: a
        for a in session.exec(select(BadgeAward).where(BadgeAward.profile_id == profile_id)).all()
    }
    return [
        BadgeStatus(
            key=badge.key,
            name=badge.name,
            description=badge.description,
            art_url=badge.art_url,
            earned=badge.id in awards_by_badge_id,
            awarded_at=awards_by_badge_id[badge.id].awarded_at if badge.id in awards_by_badge_id else None,
        )
        for badge in badges
    ]


@app.get("/api/profiles/{profile_id}/stats", response_model=ProfileStats)
def get_profile_stats(profile_id: int, session: Session = Depends(get_session)) -> ProfileStats:
    """Backs the Accomplishments screen's parent-facing stats — derived live
    from the Rating/Attempt/Event log rather than stored (HANDOFF.md §4)."""
    if session.get(Profile, profile_id) is None:
        raise HTTPException(status_code=404, detail=f"no profile with id {profile_id}")
    return compute_profile_stats(session, profile_id)


@app.post("/api/client-errors", status_code=204)
def post_client_error(payload: ClientErrorReport) -> None:
    log_client_error(payload)


@app.get("/api/games", response_model=list[GameMetadata])
def list_games() -> list[GameMetadata]:
    """Backs the Game Picker screen — lists every registered game module."""
    return [game.metadata for game in all_games()]


@app.get("/api/items/next", response_model=Item)
def get_next_item(
    profile_id: int,
    game_id: str,
    session_id: Optional[str] = None,
    session: Session = Depends(get_session),
) -> Item:
    if session.get(Profile, profile_id) is None:
        raise HTTPException(status_code=404, detail=f"no profile with id {profile_id}")
    try:
        game = get_game(game_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    # No-repeat-within-a-session (client passes a session_id it generates once
    # per play session): derive already-shown items from the event log rather
    # than tracking new mutable state, per the event-sourcing pattern elsewhere.
    exclude: set[str] = set()
    if session_id:
        shown = session.exec(
            select(Event).where(
                Event.profile_id == profile_id,
                Event.game_id == game_id,
                Event.session_id == session_id,
                Event.event_type == EventType.ITEM_SHOWN,
            )
        ).all()
        # `Event.payload` is `{**item.model_dump(), "pacing": ...}`, so the
        # item's own payload dict (where repeat_key looks) is nested one level
        # deeper, under the "payload" key.
        exclude = {
            key
            for event in shown
            if (key := game.repeat_key(event.payload.get("payload", {}))) is not None
        }

    # A parent-set practice config (see app/models/practice_config.py) fully
    # replaces the adaptive Level for this profile/game — skip
    # choose_next_item_level entirely rather than computing a directive
    # that'd go unused.
    practice_config = _get_practice_config(session, profile_id, game_id) if game.supports_practice_config() else None
    if practice_config is not None:
        item = game.generate_item_from_practice_config(
            difficulty=practice_config.difficulty,
            operations=practice_config.operations,
            focus_numbers=practice_config.focus_numbers,
            rng=Random(),
            exclude=frozenset(exclude),
        )
        pacing = "practice_config"
    else:
        directive = choose_next_item_level(
            session,
            profile_id=profile_id,
            game_id=game_id,
            max_level=game.metadata.max_level,
            rng=Random(),
        )
        item = game.generate_item(directive.level, Random(), exclude=frozenset(exclude))
        pacing = directive.kind.value

    append_event(
        session,
        profile_id=profile_id,
        game_id=game_id,
        event_type=EventType.ITEM_SHOWN,
        payload={**item.model_dump(), "pacing": pacing},
        session_id=session_id,
    )
    return item


@app.post("/api/attempts", response_model=AttemptRead, status_code=201)
def post_attempt(payload: AttemptCreate, session: Session = Depends(get_session)) -> AttemptRead:
    if session.get(Profile, payload.profile_id) is None:
        raise HTTPException(status_code=404, detail=f"no profile with id {payload.profile_id}")
    try:
        game = get_game(payload.game_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    level = get_current_level(session, payload.profile_id, payload.game_id)
    attempt = Attempt(
        item_id=payload.item_id,
        profile_id=payload.profile_id,
        game_id=payload.game_id,
        variant_id=payload.variant_id,
        session_id=payload.session_id,
        level=level,
        correct=payload.telemetry.correct,
        score=payload.telemetry.score,
        hints_used=payload.telemetry.hints_used,
        time_ms=payload.telemetry.time_ms,
        details=payload.details,
    )
    session.add(attempt)
    session.commit()
    session.refresh(attempt)

    event = append_event(
        session,
        profile_id=payload.profile_id,
        game_id=payload.game_id,
        event_type=EventType.ATTEMPT,
        payload={
            "attempt_id": attempt.id,
            "item_id": attempt.item_id,
            "level": attempt.level,
            "correct": attempt.correct,
            "score": attempt.score,
            "hints_used": attempt.hints_used,
            "time_ms": attempt.time_ms,
        },
        variant_id=payload.variant_id,
        session_id=payload.session_id,
    )

    _decision, hint_offered = process_attempt(
        session, attempt=attempt, max_level=game.metadata.max_level
    )

    evaluate_and_award_badges(session, profile_id=payload.profile_id, session_id=payload.session_id)
    session.refresh(attempt)

    return AttemptRead(
        id=attempt.id,
        correct=attempt.correct,
        score=attempt.score,
        hints_used=attempt.hints_used,
        time_ms=attempt.time_ms,
        event_id=event.event_id,
        hint_offered=hint_offered,
    )


@app.post("/api/ratings", response_model=Rating, status_code=201)
def post_rating(payload: RatingCreate, session: Session = Depends(get_session)) -> Rating:
    if session.get(Profile, payload.profile_id) is None:
        raise HTTPException(status_code=404, detail=f"no profile with id {payload.profile_id}")

    rating = Rating(
        profile_id=payload.profile_id,
        game_id=payload.game_id,
        variant_id=payload.variant_id,
        scale=payload.scale,
        value=payload.value,
    )
    session.add(rating)
    session.commit()
    session.refresh(rating)

    append_event(
        session,
        profile_id=payload.profile_id,
        game_id=payload.game_id,
        event_type=EventType.RATING_GIVEN,
        payload={"rating_id": rating.id, "scale": rating.scale.value, "value": rating.value},
        variant_id=payload.variant_id,
    )

    # `append_event`'s own commit expires every object in the session
    # (SQLAlchemy's default `expire_on_commit`), which clears `rating`'s
    # instance `__dict__` — and FastAPI's response serialization reads that
    # dict directly, so without this it would silently respond with `{}`.
    session.refresh(rating)
    return rating


@app.post("/api/verifications", response_model=Verification, status_code=201)
def post_verification(payload: VerificationCreate, session: Session = Depends(get_session)) -> Verification:
    attempt = session.get(Attempt, payload.attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail=f"no attempt with id {payload.attempt_id}")

    verification = Verification(
        attempt_id=payload.attempt_id,
        correct=payload.correct,
        verified_by=payload.verified_by,
    )
    session.add(verification)
    session.commit()
    session.refresh(verification)

    append_event(
        session,
        profile_id=attempt.profile_id,
        game_id=attempt.game_id,
        event_type=EventType.VERIFICATION_COMPLETED,
        payload={"verification_id": verification.id, "attempt_id": attempt.id, "correct": verification.correct},
        variant_id=attempt.variant_id,
        session_id=attempt.session_id,
    )

    # See the matching comment in post_rating: append_event's commit expires
    # every session-tracked object, including `verification`.
    session.refresh(verification)
    return verification


def _get_piece_or_404(session: Session, piece_id: str) -> Piece:
    piece = session.get(Piece, piece_id)
    if piece is None:
        raise HTTPException(status_code=404, detail=f"no piece with id {piece_id}")
    return piece


@app.post("/api/pieces", response_model=Piece, status_code=201)
def post_piece(payload: PieceCreate, session: Session = Depends(get_session)) -> Piece:
    if session.get(Profile, payload.profile_id) is None:
        raise HTTPException(status_code=404, detail=f"no profile with id {payload.profile_id}")

    piece = Piece(
        profile_id=payload.profile_id,
        game_id=payload.game_id,
        session_id=payload.session_id,
        title=payload.title,
        body=payload.body,
        word_count=len(payload.body.split()),
        constraints=payload.constraints,
        art_style=payload.art_style,
    )
    session.add(piece)
    session.commit()
    session.refresh(piece)

    append_event(
        session,
        profile_id=payload.profile_id,
        game_id=payload.game_id,
        event_type=EventType.PIECE_CREATED,
        payload={"piece_id": piece.id, "word_count": piece.word_count},
        session_id=payload.session_id,
    )

    evaluate_and_award_badges(session, profile_id=payload.profile_id, session_id=payload.session_id)
    session.refresh(piece)
    return piece


@app.get("/api/pieces", response_model=list[Piece])
def list_pieces(profile_id: int, game_id: Optional[str] = None, session: Session = Depends(get_session)) -> list[Piece]:
    """Backs the Storybook shelf — every piece a kid has saved, optionally
    filtered to one game."""
    query = select(Piece).where(Piece.profile_id == profile_id)
    if game_id is not None:
        query = query.where(Piece.game_id == game_id)
    return list(session.exec(query).all())


@app.get("/api/pieces/{piece_id}", response_model=Piece)
def get_piece(piece_id: str, session: Session = Depends(get_session)) -> Piece:
    return _get_piece_or_404(session, piece_id)


@app.patch("/api/pieces/{piece_id}", response_model=Piece)
def patch_piece(piece_id: str, payload: PieceUpdate, session: Session = Depends(get_session)) -> Piece:
    """The revise step edits `title` and/or `body` — HANDOFF.md §3's illustration
    gate (at least one revision change) reads `revised_at`/`word_count` off of this."""
    piece = _get_piece_or_404(session, piece_id)

    if payload.title is not None:
        piece.title = payload.title
    if payload.body is not None:
        piece.body = payload.body
        piece.word_count = len(payload.body.split())
    piece.revised_at = utcnow()

    session.add(piece)
    session.commit()
    session.refresh(piece)

    append_event(
        session,
        profile_id=piece.profile_id,
        game_id=piece.game_id,
        event_type=EventType.PIECE_REVISED,
        payload={"piece_id": piece.id, "word_count": piece.word_count},
        session_id=piece.session_id,
    )

    session.refresh(piece)
    return piece


@app.delete("/api/pieces/{piece_id}", status_code=204)
def delete_piece(piece_id: str, session: Session = Depends(get_session)) -> None:
    """Lets a kid pull a finished story off the shelf. Removes the piece's
    child rows first since there's no DB-level cascade configured."""
    piece = _get_piece_or_404(session, piece_id)

    for model in (Illustration, RevisionPass, RemixVersion, TurnLine):
        for row in session.exec(select(model).where(model.piece_id == piece_id)).all():
            session.delete(row)

    profile_id, game_id, session_id = piece.profile_id, piece.game_id, piece.session_id
    session.delete(piece)
    session.commit()

    append_event(
        session,
        profile_id=profile_id,
        game_id=game_id,
        event_type=EventType.PIECE_DELETED,
        payload={"piece_id": piece_id},
        session_id=session_id,
    )


@app.get("/api/pieces/{piece_id}/illustrations", response_model=list[Illustration])
def list_illustrations(piece_id: str, session: Session = Depends(get_session)) -> list[Illustration]:
    _get_piece_or_404(session, piece_id)
    return list(session.exec(select(Illustration).where(Illustration.piece_id == piece_id)).all())


def _create_illustration(session: Session, piece: Piece, *, prompt_excerpt: str, image_url: str, order: int, is_hero: bool) -> Illustration:
    illustration = Illustration(
        piece_id=piece.id,
        prompt_excerpt=prompt_excerpt,
        image_url=image_url,
        order=order,
        is_hero=is_hero,
    )
    session.add(illustration)
    session.commit()
    session.refresh(illustration)

    append_event(
        session,
        profile_id=piece.profile_id,
        game_id=piece.game_id,
        event_type=EventType.ILLUSTRATION_ADDED,
        payload={"piece_id": piece.id, "illustration_id": illustration.id, "is_hero": illustration.is_hero},
        session_id=piece.session_id,
    )

    session.refresh(illustration)
    return illustration


@app.post("/api/pieces/{piece_id}/illustrations", response_model=Illustration, status_code=201)
def post_illustration(piece_id: str, payload: IllustrationCreate, session: Session = Depends(get_session)) -> Illustration:
    piece = _get_piece_or_404(session, piece_id)
    return _create_illustration(
        session, piece, prompt_excerpt=payload.prompt_excerpt, image_url=payload.image_url, order=payload.order, is_hero=payload.is_hero
    )


@app.post("/api/pieces/{piece_id}/illustrations/generate", response_model=Illustration, status_code=201)
def generate_illustration(
    piece_id: str,
    payload: IllustrationGenerateRequest,
    session: Session = Depends(get_session),
    generator: ImageGenerator = Depends(get_image_generator),
) -> Illustration:
    """Generates the actual art via whichever `ImageGenerator` is configured
    (app/services/image_generation.py) and persists it. Falls back to an
    empty `image_url` — the frontend's tinted placeholder — if no provider is
    configured or generation fails, rather than failing the request."""
    piece = _get_piece_or_404(session, piece_id)

    generated = generator.generate(prompt=payload.prompt_excerpt, style=piece.art_style)
    image_url = save_generated_image(piece_id, generated) if generated else ""

    return _create_illustration(
        session, piece, prompt_excerpt=payload.prompt_excerpt, image_url=image_url, order=payload.order, is_hero=payload.is_hero
    )


@app.post("/api/pieces/{piece_id}/revisions", response_model=RevisionPass, status_code=201)
def post_revision_pass(piece_id: str, payload: RevisionPassCreate, session: Session = Depends(get_session)) -> RevisionPass:
    """Records one coach pass. `changed` (not just that the pass ran) is what
    HANDOFF.md §3's illustration gate cares about."""
    _get_piece_or_404(session, piece_id)

    revision = RevisionPass(
        piece_id=piece_id,
        questions_asked=payload.questions_asked,
        changed=payload.changed,
    )
    session.add(revision)
    session.commit()
    session.refresh(revision)
    return revision


@app.post("/api/pieces/{piece_id}/remixes", response_model=RemixVersion, status_code=201)
def post_remix_version(piece_id: str, payload: RemixVersionCreate, session: Session = Depends(get_session)) -> RemixVersion:
    """Style Remix Lab only — one row per style the kid tries on the same piece."""
    _get_piece_or_404(session, piece_id)

    remix = RemixVersion(
        piece_id=piece_id,
        style_key=payload.style_key,
        body=payload.body,
        is_favourite=payload.is_favourite,
    )
    session.add(remix)
    session.commit()
    session.refresh(remix)
    return remix


@app.post("/api/pieces/{piece_id}/turns", response_model=TurnLine, status_code=201)
def post_turn_line(piece_id: str, payload: TurnLineCreate, session: Session = Depends(get_session)) -> TurnLine:
    """Tag-Team Story only — appends one line, kid- or AI-authored, to the piece."""
    _get_piece_or_404(session, piece_id)

    turn = TurnLine(
        piece_id=piece_id,
        author=payload.author,
        text=payload.text,
        order=payload.order,
    )
    session.add(turn)
    session.commit()
    session.refresh(turn)
    return turn
