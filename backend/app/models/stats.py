"""ProfileStats: the read-model backing the Accomplishments screen's parent
view — HANDOFF.md §4. Every field is computed live from Rating/Attempt/Piece/
Event history in `app.services.badges_service.compute_profile_stats`; none of
it is stored, so there's nothing here to keep in sync when new activity
happens.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProfileStats(BaseModel):
    total_stars: int
    day_streak: int
    minutes_this_week: int
    most_played_game: Optional[str] = None
    avg_rating: Optional[float] = None
    last_session_at: Optional[datetime] = None
    progress_delta_pct: Optional[int] = None
    """Percentage-point change in this month's correct-attempt rate vs. last
    month's. `None` when there isn't a full prior month of attempts to
    compare against, rather than fabricating a number."""
