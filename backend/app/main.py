"""FastAPI app — PRD §9, §16 step 3.

Two endpoints only, per this task's scope:
- GET  /api/items/next   : server selects the level, generates an Item, logs `item_shown`.
- POST /api/attempts     : validates the telemetry core, persists the Attempt, logs `attempt`.

No accounts/auth (PRD §2 non-goals). A single demo profile is seeded on startup
so there's something to point the placeholder frontend and curl at; real
profile management is out of scope here.
"""

from contextlib import asynccontextmanager
from random import Random
from typing import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

import app.games  # noqa: F401  (populates the game registry on import)
from app.db import create_db_and_tables, engine, get_session
from app.engine.level_selector import get_current_level
from app.events.log import append_event
from app.games.registry import get_game
from app.models.attempt import Attempt, AttemptCreate, AttemptRead
from app.models.enums import EventType
from app.models.item import Item
from app.models.profile import Profile
from app.services.loop_a_service import choose_next_item_level, process_attempt


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    create_db_and_tables()
    with Session(engine) as session:
        _seed_demo_profile(session)
    yield


app = FastAPI(title="Adaptive Learning Games API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _seed_demo_profile(session: Session) -> None:
    if session.get(Profile, 1) is None:
        session.add(Profile(id=1, name="Demo Kid", avatar="fox", birth_year=2020))
        session.commit()


@app.get("/api/items/next", response_model=Item)
def get_next_item(profile_id: int, game_id: str, session: Session = Depends(get_session)) -> Item:
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
    item = game.generate_item(directive.level, Random())

    append_event(
        session,
        profile_id=profile_id,
        game_id=game_id,
        event_type=EventType.ITEM_SHOWN,
        payload={**item.model_dump(), "pacing": directive.kind.value},
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

    return AttemptRead(
        id=attempt.id,
        correct=attempt.correct,
        score=attempt.score,
        hints_used=attempt.hints_used,
        time_ms=attempt.time_ms,
        event_id=event.event_id,
        hint_offered=hint_offered,
    )
