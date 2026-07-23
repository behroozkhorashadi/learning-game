"""Item: one playable unit of a game at a chosen config — PRD §4, §6.

Not a DB table. It is produced fresh by `generate_item(level, rng)` on every
request; its history is captured by the `item_shown` event the endpoint emits,
not by a mutable Items table (PRD §5.3: log events, don't mutate-and-reconstruct).
May represent a single challenge or a whole short round — `payload` is
deliberately free-form so the client can own how it plays out.
"""

from typing import Any, Optional

from pydantic import BaseModel


class Item(BaseModel):
    item_id: str
    game_id: str
    variant_id: Optional[str] = None
    level: int
    payload: dict[str, Any]
