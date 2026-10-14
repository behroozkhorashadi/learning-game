import pytest
from pydantic import ValidationError

from app.armory.armory_ports_pure import LookLockedError, UnknownArtError
from app.armory.armory_schemas_pure import ArmoryLooks, Emblem, HungPictures, SuitPaint
from app.armory.looks_reducers_pure import checked_looks, looks_state
from tests.armory.armory_fakes import art_piece

STARTER = ("starter_blaster", "standard_rounds", "steel_suit")
EVERYTHING = (
    *STARTER,
    "gold_suit",
    "suit_paint",
    "blaster_paint",
    "emblem_maker",
    "pathfinder_frame",
    "horde_billboard",
)


def full_looks() -> ArmoryLooks:
    return ArmoryLooks(
        skin_id="gold_suit",
        suit_paint=SuitPaint(color="#FF00AA", shine="glow"),
        blaster_color="#00FF88",
        emblem=Emblem(art_id="a1", color="#FFFFFF", place="both"),
        hung=HungPictures(pathfinder="a2", horde="a1"),
    )


def test_the_default_look_needs_nothing() -> None:
    assert checked_looks(ArmoryLooks(), owned=STARTER, gallery=()) == ArmoryLooks()


def test_every_customization_is_allowed_once_its_unlock_is_owned() -> None:
    assert checked_looks(full_looks(), owned=EVERYTHING, gallery=(art_piece("a1"), art_piece("a2"))) == full_looks()


@pytest.mark.parametrize(
    ("looks", "needs"),
    [
        (ArmoryLooks(skin_id="gold_suit"), "gold_suit"),
        (ArmoryLooks(skin_id="rapid_blaster"), "rapid_blaster"),
        (ArmoryLooks(suit_paint=SuitPaint(color="#123456", shine="matte")), "suit_paint"),
        (ArmoryLooks(blaster_color="#123456"), "blaster_paint"),
        (ArmoryLooks(emblem=Emblem(symbol="star", color="#123456", place="arm")), "emblem_maker"),
        (ArmoryLooks(hung=HungPictures(pathfinder="a1")), "pathfinder_frame"),
        (ArmoryLooks(hung=HungPictures(horde="a1")), "horde_billboard"),
    ],
)
def test_a_locked_customization_is_refused(looks: ArmoryLooks, needs: str) -> None:
    with pytest.raises(LookLockedError, match=needs):
        checked_looks(looks, owned=STARTER, gallery=(art_piece("a1"),))


def test_art_must_be_in_the_profiles_own_gallery() -> None:
    with pytest.raises(UnknownArtError, match="a2"):
        checked_looks(full_looks(), owned=EVERYTHING, gallery=(art_piece("a1"),))


def test_an_emblem_shows_a_symbol_or_art_never_both_or_neither() -> None:
    with pytest.raises(ValidationError):
        Emblem(symbol="star", art_id="a1", color="#FFFFFF", place="arm")
    with pytest.raises(ValidationError):
        Emblem(color="#FFFFFF", place="arm")


def test_colours_must_be_hex() -> None:
    with pytest.raises(ValidationError):
        ArmoryLooks(blaster_color="red")


def test_looks_state_has_the_url_of_each_art_piece_used_and_drops_missing_ones() -> None:
    state = looks_state(full_looks(), (art_piece("a1"), art_piece("a3")))
    assert state.pictures == {"a1": "/static/armory-art/a1.jpg"}
    assert state.looks == full_looks()
