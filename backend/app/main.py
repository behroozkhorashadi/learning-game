"""FastAPI app — PRD §9, §16 step 3.

- GET  /api/profiles     : read-only listing for the profile-picker screen.
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

No accounts/auth (PRD §2 non-goals). A demo profile plus one hardcoded real
tester profile are seeded on startup so there's something to point the
frontend and curl at; real profile management (creation/editing) is out of
scope here.
"""

from contextlib import asynccontextmanager
from random import Random
from typing import AsyncIterator, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

import app.games  # noqa: F401  (populates the game registry on import)
from app.db import create_db_and_tables, engine, get_session
from app.engine.level_selector import get_current_level
from app.events.log import append_event
from app.games.registry import all_games, get_game
from app.util import utcnow
from app.models.attempt import Attempt, AttemptCreate, AttemptRead
from app.models.badge import Badge, BadgeAward, BadgeStatus
from app.models.enums import EventType
from app.models.event import Event
from app.models.game import GameMetadata
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
from app.models.profile import Profile
from app.models.rating import Rating, RatingCreate
from app.models.stats import ProfileStats
from app.models.verification import Verification, VerificationCreate
from app.services.badges_service import compute_profile_stats, evaluate_and_award_badges, seed_badges
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
    # A real named tester (the developer's nephew) hardcoded alongside the
    # demo profile — id=2 is stable so his attempts/badges/session history
    # persist across restarts instead of being re-seeded from scratch. Only
    # `birth_year` is stored (see Profile.age's own docstring on why), so
    # his Oct 22, 2019 birthday is captured as precisely as the schema allows.
    if session.get(Profile, 2) is None:
        session.add(Profile(id=2, name="Rami", avatar="rami", birth_year=2019))
    session.commit()


@app.get("/api/profiles", response_model=list[Profile])
def list_profiles(session: Session = Depends(get_session)) -> list[Profile]:
    """Read-only listing for the profile-picker screen. No auth (PRD §2 non-goals)."""
    return list(session.exec(select(Profile)).all())


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

    directive = choose_next_item_level(
        session,
        profile_id=profile_id,
        game_id=game_id,
        max_level=game.metadata.max_level,
        rng=Random(),
    )

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

    item = game.generate_item(directive.level, Random(), exclude=frozenset(exclude))

    append_event(
        session,
        profile_id=profile_id,
        game_id=game_id,
        event_type=EventType.ITEM_SHOWN,
        payload={**item.model_dump(), "pacing": directive.kind.value},
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
