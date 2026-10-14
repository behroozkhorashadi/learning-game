"""The rules for a profile's looks: what each customization needs owned before it can
be saved, and which art URLs a set of looks uses. No I/O."""

from collections.abc import Sequence

from app.armory.armory_ports_pure import LookLockedError, UnknownArtError
from app.armory.armory_reducers_pure import (
    BLASTER_PAINT_ID,
    CATALOG,
    EMBLEM_MAKER_ID,
    HORDE_BILLBOARD_ID,
    PATHFINDER_FRAME_ID,
    SUIT_PAINT_ID,
)
from app.armory.armory_schemas_pure import ArmoryLooks, ArmoryLooksState, ArtPiece


def checked_looks(looks: ArmoryLooks, *, owned: Sequence[str], gallery: Sequence[ArtPiece]) -> ArmoryLooks:
    """`looks`, if everything it uses is owned: the skin, the unlock behind each
    customization, and every art piece (from this profile's own gallery)."""
    needed: list[str] = []
    if looks.skin_id is not None:
        if not any(item.id == looks.skin_id and item.kind == "skin" for item in CATALOG):
            raise LookLockedError(looks.skin_id)
        needed.append(looks.skin_id)
    if looks.suit_paint is not None:
        needed.append(SUIT_PAINT_ID)
    if looks.blaster_color is not None:
        needed.append(BLASTER_PAINT_ID)
    if looks.emblem is not None:
        needed.append(EMBLEM_MAKER_ID)
    if looks.hung.pathfinder is not None:
        needed.append(PATHFINDER_FRAME_ID)
    if looks.hung.horde is not None:
        needed.append(HORDE_BILLBOARD_ID)
    for item_id in needed:
        if item_id not in owned:
            raise LookLockedError(item_id)
    art_ids = {piece.id for piece in gallery}
    for art_id in _art_ids(looks):
        if art_id not in art_ids:
            raise UnknownArtError(art_id)
    return looks


def looks_state(looks: ArmoryLooks, gallery: Sequence[ArtPiece]) -> ArmoryLooksState:
    """The looks with the URL of each art piece they use. A piece no longer in the
    gallery is left out of `pictures`, so a game falls back to its plain look."""
    urls = {piece.id: piece.image_url for piece in gallery}
    return ArmoryLooksState(
        looks=looks, pictures={art_id: urls[art_id] for art_id in _art_ids(looks) if art_id in urls}
    )


def _art_ids(looks: ArmoryLooks) -> tuple[str, ...]:
    ids = (looks.emblem.art_id if looks.emblem is not None else None, looks.hung.pathfinder, looks.hung.horde)
    return tuple(dict.fromkeys(art_id for art_id in ids if art_id is not None))
