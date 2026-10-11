"""Pure armory rules: the catalog, the ledger entries a round or purchase adds, and the
state derived from a profile's ledger. No I/O; the clock reading arrives as an argument.

Prices are tuned so each upgrade is a handful of good rounds away (PRD "Rewards, kept
healthy": no grind, no timed offers, nothing that punishes not playing)."""

from collections.abc import Sequence
from datetime import datetime

from app.armory.armory_ports_pure import (
    AlreadyOwnedError,
    MissingPrerequisiteError,
    NotEnoughPointsError,
    UnknownItemError,
)
from app.armory.armory_schemas_pure import ArmoryEntry, ArmoryItem, ArmoryRoundCreate, ArmoryState

# Every profile starts with one grenade, so the first round shows what one does.
STARTING_GRENADES = 1

CATALOG: tuple[ArmoryItem, ...] = (
    ArmoryItem(
        id="starter_blaster",
        kind="weapon",
        name="Starter Blaster",
        description="Your trusty blaster.",
        price=0,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id="rapid_blaster",
        kind="weapon",
        name="Rapid Blaster",
        description="Reloads twice as fast and hits a little harder.",
        price=250,
        quantity=1,
        consumable=False,
        requires="starter_blaster",
    ),
    ArmoryItem(
        id="mega_blaster",
        kind="weapon",
        name="Mega Blaster",
        description="Huge hits and a lightning-fast reload.",
        price=600,
        quantity=1,
        consumable=False,
        requires="rapid_blaster",
    ),
    ArmoryItem(
        id="standard_rounds",
        kind="bullet",
        name="Standard Rounds",
        description="Never run out. Headshots hit hardest; leg shots knock zombies down.",
        price=0,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id="armor_piercing",
        kind="bullet",
        name="Armor-Piercing Rounds",
        description="25 rounds. Body and leg shots hit much harder.",
        price=60,
        quantity=25,
        consumable=True,
        requires=None,
    ),
    ArmoryItem(
        id="explosive_rounds",
        kind="bullet",
        name="Explosive Rounds",
        description="25 rounds. Every shot hits harder, wherever it lands.",
        price=120,
        quantity=25,
        consumable=True,
        requires=None,
    ),
    ArmoryItem(
        id="grenade_pack",
        kind="grenade",
        name="Grenade Pack",
        description="Three grenades. A grenade only goes off near the zombie with the right answer.",
        price=80,
        quantity=3,
        consumable=True,
        requires=None,
    ),
)


def catalog_item(item_id: str) -> ArmoryItem:
    for item in CATALOG:
        if item.id == item_id:
            return item
    raise UnknownItemError(item_id)


def summarize(profile_id: int, entries: Sequence[ArmoryEntry]) -> ArmoryState:
    """The whole armory state for one profile, derived from its ledger."""
    earned = sum(e.points for e in entries if e.kind == "earned")
    spent = sum(e.points for e in entries if e.kind == "purchased")
    purchased = [e.item_id for e in entries if e.kind == "purchased" and e.item_id is not None]
    owned = [item.id for item in CATALOG if not item.consumable and (item.price == 0 or item.id in purchased)]
    bought_grenades = sum(e.quantity for e in entries if e.kind == "purchased" and _is_grenade(e.item_id))
    used_grenades = sum(e.quantity for e in entries if e.kind == "grenades_used")
    ammo = {
        item.id: max(
            sum(e.quantity for e in entries if e.kind == "purchased" and e.item_id == item.id)
            - sum(e.quantity for e in entries if e.kind == "rounds_used" and e.item_id == item.id),
            0,
        )
        for item in CATALOG
        if item.kind == "bullet" and item.consumable
    }
    return ArmoryState(
        profile_id=profile_id,
        balance=earned - spent,
        earned=earned,
        spent=spent,
        owned=owned,
        grenades=max(STARTING_GRENADES + bought_grenades - used_grenades, 0),
        ammo=ammo,
        catalog=list(CATALOG),
    )


def round_entries(profile_id: int, round_result: ArmoryRoundCreate, *, now: datetime) -> tuple[ArmoryEntry, ...]:
    """What a finished round adds. The caller clamps grenades and rounds to what's
    left (`clamped_round`), so no count goes negative."""
    entries: list[ArmoryEntry] = []
    if round_result.points > 0:
        entries.append(
            ArmoryEntry(
                profile_id=profile_id,
                kind="earned",
                item_id=None,
                points=round_result.points,
                quantity=0,
                created_at=now,
            )
        )
    if round_result.grenades_used > 0:
        entries.append(
            ArmoryEntry(
                profile_id=profile_id,
                kind="grenades_used",
                item_id=None,
                points=0,
                quantity=round_result.grenades_used,
                created_at=now,
            )
        )
    entries.extend(
        ArmoryEntry(profile_id=profile_id, kind="rounds_used", item_id=item_id, points=0, quantity=used, created_at=now)
        for item_id, used in sorted(round_result.rounds_used.items())
        if used > 0
    )
    return tuple(entries)


def clamped_round(state: ArmoryState, round_result: ArmoryRoundCreate) -> ArmoryRoundCreate:
    """A round's grenades and rounds, capped at what the profile had; rounds of a
    bullet it never had are dropped."""
    return ArmoryRoundCreate(
        points=round_result.points,
        grenades_used=min(round_result.grenades_used, state.grenades),
        rounds_used={
            item_id: min(used, state.ammo[item_id])
            for item_id, used in round_result.rounds_used.items()
            if item_id in state.ammo
        },
    )


def purchase_entry(state: ArmoryState, item_id: str, *, now: datetime) -> ArmoryEntry:
    """The ledger row for buying `item_id`, or the reason it can't be bought."""
    item = catalog_item(item_id)
    if not item.consumable and item.id in state.owned:
        raise AlreadyOwnedError(item.id)
    if item.requires is not None and item.requires not in state.owned:
        raise MissingPrerequisiteError(item.id, item.requires)
    if item.price > state.balance:
        raise NotEnoughPointsError(item.id, item.price, state.balance)
    return ArmoryEntry(
        profile_id=state.profile_id,
        kind="purchased",
        item_id=item.id,
        points=item.price,
        quantity=item.quantity if item.consumable else 1,
        created_at=now,
    )


def _is_grenade(item_id: str | None) -> bool:
    return any(item.id == item_id and item.kind == "grenade" for item in CATALOG)
