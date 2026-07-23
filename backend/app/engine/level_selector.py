"""Reads/creates the stored per-(profile, game) `Level` row — PRD §5.1, §6.

`get_or_create_level` returns the row itself (not just the int) because
`app.services.loop_a_service` needs `updated_at` too: it is the boundary that
scopes Loop A's mastery window to attempts made since the level was last set.
"""

from sqlmodel import Session, select

from app.models.game import Level


def get_or_create_level(session: Session, profile_id: int, game_id: str) -> Level:
    level = session.exec(
        select(Level).where(Level.profile_id == profile_id, Level.game_id == game_id)
    ).first()
    if level is None:
        level = Level(profile_id=profile_id, game_id=game_id, value=1)
        session.add(level)
        session.commit()
        session.refresh(level)
    return level


def get_current_level(session: Session, profile_id: int, game_id: str) -> int:
    return get_or_create_level(session, profile_id, game_id).value
