import pytest

from app.armory.armory_ports_pure import (
    AlreadyOwnedError,
    MissingPrerequisiteError,
    NotEnoughPointsError,
    UnknownItemError,
)
from app.armory.armory_reducers_pure import (
    CATALOG,
    STARTING_GRENADES,
    catalog_item,
    purchase_entry,
    round_entries,
    summarize,
)
from app.armory.armory_schemas_pure import ArmoryRoundCreate
from tests.armory.armory_fakes import NOW, earned


def test_a_new_profile_owns_the_free_items_and_one_grenade() -> None:
    state = summarize(1, ())
    assert (state.balance, state.earned, state.spent) == (0, 0, 0)
    assert state.owned == ["starter_blaster", "standard_rounds"]
    assert state.grenades == STARTING_GRENADES
    assert state.catalog == list(CATALOG)


def test_catalog_ids_are_unique_and_prerequisites_exist() -> None:
    ids = [item.id for item in CATALOG]
    assert len(ids) == len(set(ids))
    for item in CATALOG:
        assert item.requires is None or item.requires in ids


def test_a_round_banks_points_and_spends_grenades() -> None:
    entries = round_entries(1, ArmoryRoundCreate(points=120, grenades_used=1), now=NOW)
    state = summarize(1, entries)
    assert (state.balance, state.earned, state.grenades) == (120, 120, STARTING_GRENADES - 1)


def test_an_empty_round_adds_nothing() -> None:
    assert round_entries(1, ArmoryRoundCreate(points=0, grenades_used=0), now=NOW) == ()


def test_buying_spends_points_and_owns_the_item() -> None:
    before = summarize(1, (earned(300),))
    entry = purchase_entry(before, "rapid_blaster", now=NOW)
    after = summarize(1, (earned(300), entry))
    assert (after.balance, after.spent) == (50, 250)
    assert "rapid_blaster" in after.owned


def test_grenade_packs_stack_and_are_never_owned() -> None:
    entries = [earned(200)]
    for _ in range(2):
        entries.append(purchase_entry(summarize(1, entries), "grenade_pack", now=NOW))
    state = summarize(1, entries)
    assert state.grenades == STARTING_GRENADES + 6
    assert "grenade_pack" not in state.owned
    assert state.balance == 40


def test_purchase_refusals() -> None:
    rich = summarize(1, (earned(5000),))
    with pytest.raises(AlreadyOwnedError):
        purchase_entry(rich, "starter_blaster", now=NOW)
    with pytest.raises(MissingPrerequisiteError):
        purchase_entry(rich, "mega_blaster", now=NOW)
    with pytest.raises(NotEnoughPointsError):
        purchase_entry(summarize(1, (earned(10),)), "rapid_blaster", now=NOW)
    with pytest.raises(UnknownItemError):
        catalog_item("laser_sword")


def test_grenades_never_go_negative() -> None:
    entries = round_entries(1, ArmoryRoundCreate(points=0, grenades_used=5), now=NOW)
    assert summarize(1, entries).grenades == 0
