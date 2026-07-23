"""Trivial stand-in for Loop A (PRD §5.1) — real promote/hold/support logic is
out of scope for this task. This only guarantees difficulty selection lives
server-side, reading the stored per-(profile, game) `Level` and defaulting to 1,
so the real engine can slot in here later without moving where the decision is made.
"""

from sqlmodel import Session, select

from app.models.game import Level


def get_current_level(session: Session, profile_id: int, game_id: str) -> int:
    level = session.exec(
        select(Level).where(Level.profile_id == profile_id, Level.game_id == game_id)
    ).first()
    if level is None:
        level = Level(profile_id=profile_id, game_id=game_id, value=1)
        session.add(level)
        session.commit()
        session.refresh(level)
    return level.value
