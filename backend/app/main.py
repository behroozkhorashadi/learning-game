"""FastAPI app — PRD §9, §16 step 3.

- /api/profiles[...], /api/profile-photos/remix, /api/admin/login: migrated to
  app/profiles/ and app/admin/ (wired in app/composition/).
- /api/games, /api/items/next, /api/attempts, /api/ratings, /api/verifications:
  migrated to app/play/ (and the event log to app/events/).
- GET  /api/profiles/{id}/badges, /stats: the Accomplishments screen's badge list and
  live-derived stats read-model.
- POST /api/pieces, GET /api/pieces, GET/PATCH/DELETE /api/pieces/{id}: the writing-layer's
  saved-story record (HANDOFF.md §4).
- POST /api/pieces/{id}/illustrations, /revisions, /remixes, /turns: a piece's
  child records — generated art, coach revision passes, Style Remix Lab
  versions, and Tag-Team Story turns, respectively.
- GET/PUT/DELETE /api/practice-config: migrated to app/practice/ (wired in
  app/composition/).
- /api/profiles/{id}/pathfinder/completions, /maps[/{map_id}], and
  /api/pathfinder/published-maps: migrated to app/pathfinder/.
- POST /api/client-errors: migrated to app/crash_reports/.

No accounts/auth (PRD §2 non-goals) beyond the admin screen's hardcoded
password gate. A demo profile is always seeded on startup so there's
something to point the frontend and curl at; a second, real named tester
profile can be seeded locally via LOCAL_SEED_PROFILE_* env vars (see
backend/.env.example) without that person's name/photo living in the repo.
"""

from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from app.composition.app_settings_assembly import load_settings
from app.composition.app_wiring_assembly import assemble_features
from app.db import create_db_and_tables, engine, get_session
from app.events.log import append_event
from app.models.enums import EventType
from app.util import utcnow
from app.models.badge import Badge, BadgeAward, BadgeStatus
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
from app.models.stats import ProfileStats
from app.services.badges_service import compute_profile_stats, evaluate_and_award_badges, seed_badges
from app.services.image_generation import STATIC_DIR, ImageGenerator, get_image_generator, save_generated_image


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    create_db_and_tables()
    features.seed_profiles()
    with Session(engine) as session:
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

def _erase_legacy_profile_rows(profile_id: int) -> None:
    """Deletes the rows the legacy routes below keep for a profile (no DB-level cascade
    is configured). The profiles feature calls this, through assembly, before it deletes
    the profile itself."""
    with Session(engine) as session:
        piece_ids = [p.id for p in session.exec(select(Piece).where(Piece.profile_id == profile_id)).all()]
        for model in (Illustration, RevisionPass, RemixVersion, TurnLine):
            for row in session.exec(select(model).where(model.piece_id.in_(piece_ids))).all():
                session.delete(row)
        for piece_id in piece_ids:
            piece = session.get(Piece, piece_id)
            if piece is not None:
                session.delete(piece)
        for award in session.exec(select(BadgeAward).where(BadgeAward.profile_id == profile_id)).all():
            session.delete(award)
        session.commit()


def _award_badges_after_attempt(profile_id: int, session_id: Optional[str]) -> None:
    with Session(engine) as session:
        evaluate_and_award_badges(session, profile_id=profile_id, session_id=session_id)


# New-style features (backend/AGENTS.md) are wired in app/composition/, not here.
features = assemble_features(
    app,
    load_settings(),
    erase_legacy_profile_rows=_erase_legacy_profile_rows,
    after_attempt=_award_badges_after_attempt,
)


@app.get("/api/profiles/{profile_id}/badges", response_model=list[BadgeStatus])
def get_profile_badges(profile_id: int, session: Session = Depends(get_session)) -> list[BadgeStatus]:
    """Backs the Accomplishments screen's badge shelf — every seeded badge,
    annotated with whether (and when) this profile earned it."""
    if not features.profiles.exists(profile_id):
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
    if not features.profiles.exists(profile_id):
        raise HTTPException(status_code=404, detail=f"no profile with id {profile_id}")
    return compute_profile_stats(session, profile_id, game_title=features.play.game_title)


def _get_piece_or_404(session: Session, piece_id: str) -> Piece:
    piece = session.get(Piece, piece_id)
    if piece is None:
        raise HTTPException(status_code=404, detail=f"no piece with id {piece_id}")
    return piece


@app.post("/api/pieces", response_model=Piece, status_code=201)
def post_piece(payload: PieceCreate, session: Session = Depends(get_session)) -> Piece:
    if not features.profiles.exists(payload.profile_id):
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
