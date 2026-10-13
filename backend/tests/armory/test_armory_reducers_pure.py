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
    clamped_round,
    purchase_entry,
    round_entries,
    summarize,
)
from app.armory.armory_schemas_pure import ArmoryRoundCreate
from tests.armory.armory_fakes import NOW, earned


def test_a_new_profile_owns_the_free_items_and_one_grenade() -> None:
    state = summarize(1, ())
    assert (state.balance, state.earned, state.spent) == (0, 0, 0)
    assert state.owned == ["starter_blaster", "standard_rounds", "steel_suit"]
    assert state.grenades == STARTING_GRENADES
    assert state.best_survived_ms == 0
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


def test_the_personal_best_is_the_longest_round_and_costs_no_points() -> None:
    rounds = (
        ArmoryRoundCreate(points=100, grenades_used=0, survived_ms=60_000),
        ArmoryRoundCreate(points=300, grenades_used=0, survived_ms=95_500),
        ArmoryRoundCreate(points=40, grenades_used=0, survived_ms=21_000),
    )
    state = summarize(1, tuple(entry for r in rounds for entry in round_entries(1, r, now=NOW)))
    assert (state.best_survived_ms, state.balance) == (95_500, 440)


def test_a_round_keeps_how_long_it_lasted_through_clamping() -> None:
    clamped = clamped_round(summarize(1, ()), ArmoryRoundCreate(points=0, grenades_used=9, survived_ms=70_000))
    assert (clamped.grenades_used, clamped.survived_ms) == (STARTING_GRENADES, 70_000)


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


def test_special_rounds_come_in_packs_that_stack_and_get_used_up() -> None:
    entries = [earned(200)]
    for _ in range(2):
        entries.append(purchase_entry(summarize(1, entries), "armor_piercing", now=NOW))
    state = summarize(1, entries)
    assert state.ammo == {"armor_piercing": 50, "explosive_rounds": 0}
    assert "armor_piercing" not in state.owned
    entries.extend(
        round_entries(1, ArmoryRoundCreate(points=0, grenades_used=0, rounds_used={"armor_piercing": 18}), now=NOW)
    )
    assert summarize(1, entries).ammo["armor_piercing"] == 32


def test_a_round_can_only_use_rounds_and_grenades_it_had() -> None:
    state = summarize(1, (earned(100), purchase_entry(summarize(1, (earned(100),)), "armor_piercing", now=NOW)))
    clamped = clamped_round(
        state, ArmoryRoundCreate(points=5, grenades_used=9, rounds_used={"armor_piercing": 99, "laser": 3})
    )
    assert clamped == ArmoryRoundCreate(points=5, grenades_used=STARTING_GRENADES, rounds_used={"armor_piercing": 25})


def test_standard_rounds_never_run_out() -> None:
    assert "standard_rounds" in summarize(1, ()).owned
    assert "standard_rounds" not in summarize(1, ()).ammo


def test_a_new_profile_has_no_gem_charges() -> None:
    assert summarize(1, ()).gems == {"reflect_gem": 0, "block_gem": 0, "mega_gem": 0, "heal_gem": 0}


def test_gems_stack_their_charges_and_get_used_up() -> None:
    entries = [earned(500)]
    for item_id in ("reflect_gem", "reflect_gem", "mega_gem"):
        entries.append(purchase_entry(summarize(1, entries), item_id, now=NOW))
    state = summarize(1, entries)
    assert state.gems == {"reflect_gem": 4, "block_gem": 0, "mega_gem": 2, "heal_gem": 0}
    assert not {"reflect_gem", "mega_gem"} & set(state.owned)
    used = ArmoryRoundCreate(points=0, grenades_used=0, gems_used={"reflect_gem": 3, "mega_gem": 1})
    entries.extend(round_entries(1, used, now=NOW))
    assert summarize(1, entries).gems == {"reflect_gem": 1, "block_gem": 0, "mega_gem": 1, "heal_gem": 0}


def test_a_round_can_only_use_gem_charges_it_had() -> None:
    state = summarize(1, (earned(100), purchase_entry(summarize(1, (earned(100),)), "block_gem", now=NOW)))
    clamped = clamped_round(
        state, ArmoryRoundCreate(points=0, grenades_used=0, gems_used={"block_gem": 9, "mega_gem": 1, "laser": 3})
    )
    assert clamped.gems_used == {"block_gem": 2, "mega_gem": 0}


def test_skins_and_thorns_are_bought_once_and_kept() -> None:
    entries = [earned(500)]
    for item_id in ("jungle_camo", "thorns_plating"):
        entries.append(purchase_entry(summarize(1, entries), item_id, now=NOW))
    state = summarize(1, entries)
    assert {"steel_suit", "jungle_camo", "thorns_plating"} <= set(state.owned)
    assert state.balance == 150
    with pytest.raises(AlreadyOwnedError):
        purchase_entry(state, "jungle_camo", now=NOW)
    with pytest.raises(AlreadyOwnedError):
        purchase_entry(state, "thorns_plating", now=NOW)
