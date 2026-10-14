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
    NotSoldHereError,
    UnknownItemError,
)
from app.armory.armory_schemas_pure import (
    ArmoryEntry,
    ArmoryItem,
    ArmoryRoundCreate,
    ArmoryState,
    BestSurvived,
    Difficulty,
)

# Bought by making a piece of art in the art studio (art_studio_service_effect.py).
ART_ITEM_ID = "art_studio"

# The style unlocks: each is bought once and opens one part of the Style Studio.
SUIT_PAINT_ID = "suit_paint"
BLASTER_PAINT_ID = "blaster_paint"
EMBLEM_MAKER_ID = "emblem_maker"
PATHFINDER_FRAME_ID = "pathfinder_frame"
HORDE_BILLBOARD_ID = "horde_billboard"

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
        description="Huge hits and a lightning-fast reload. With Explosive Rounds, one headshot does it.",
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
        description="25 rounds. Every shot hits harder and blows up where it lands.",
        price=120,
        quantity=25,
        consumable=True,
        requires=None,
    ),
    ArmoryItem(
        id="grenade_pack",
        kind="grenade",
        name="Grenade Pack",
        description="Three grenades. Defeats the zombie with the right answer and knocks down every zombie near it.",
        price=150,
        quantity=3,
        consumable=True,
        requires=None,
    ),
    ArmoryItem(
        id="reflect_gem",
        kind="gem",
        name="Reflect Gem",
        description="Snaps onto your armor. Bounces 2 thrown things back at the zombie that threw them.",
        price=60,
        quantity=2,
        consumable=True,
        requires=None,
    ),
    ArmoryItem(
        id="block_gem",
        kind="gem",
        name="Block Gem",
        description="Snaps onto your armor. Twice, a zombie that reaches you only does half a heart, then flies back.",
        price=80,
        quantity=2,
        consumable=True,
        requires=None,
    ),
    ArmoryItem(
        id="mega_gem",
        kind="gem",
        name="Mega Gem",
        description="Does both, twice: reflects a throw or blocks a hit, whichever comes first.",
        price=150,
        quantity=2,
        consumable=True,
        requires=None,
    ),
    ArmoryItem(
        id="heal_gem",
        kind="gem",
        name="Heal Gem",
        description="Snaps onto your armor. Twice, 5 right answers in a row win back half a heart.",
        price=100,
        quantity=2,
        consumable=True,
        requires=None,
    ),
    ArmoryItem(
        id="thorns_plating",
        kind="upgrade",
        name="Thorns Plating",
        description="Spikes on your armor. Every zombie you block gets hurt too. Yours for good.",
        price=250,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id="steel_suit",
        kind="skin",
        name="Steel Suit",
        description="Your trusty armor.",
        price=0,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id="jungle_camo",
        kind="skin",
        name="Jungle Camo",
        description="Green and sneaky. Just for looks.",
        price=100,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id="galaxy_suit",
        kind="skin",
        name="Galaxy Suit",
        description="Deep purple with a starry glow. Just for looks.",
        price=200,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id="gold_suit",
        kind="skin",
        name="Gold Suit",
        description="Shiny gold, for true zombie champions. Just for looks.",
        price=400,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id=SUIT_PAINT_ID,
        kind="style",
        name="Suit Paint Studio",
        description="Paint your armor any colour you like: matte, shiny, or glowing.",
        price=150,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id=BLASTER_PAINT_ID,
        kind="style",
        name="Blaster Paint",
        description="Paint your blaster any colour you like.",
        price=150,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id=EMBLEM_MAKER_ID,
        kind="style",
        name="Emblem Maker",
        description="Design your own badge for your arm or blaster: a symbol, or one of your art pieces.",
        price=120,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id=PATHFINDER_FRAME_ID,
        kind="style",
        name="Pathfinder Backdrop",
        description="Hang one of your art pieces behind the Pathfinder board.",
        price=100,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id=HORDE_BILLBOARD_ID,
        kind="style",
        name="Horde Billboard",
        description="Hang one of your art pieces on a giant billboard in Zombie Horde.",
        price=100,
        quantity=1,
        consumable=False,
        requires=None,
    ),
    ArmoryItem(
        id=ART_ITEM_ID,
        kind="art",
        name="Art Studio",
        description="Snap a selfie and turn it into a one-of-a-kind piece of art for your gallery.",
        price=300,
        quantity=1,
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
        item.id: _left(entries, item.id, used_kind="rounds_used")
        for item in CATALOG
        if item.kind == "bullet" and item.consumable
    }
    gems = {item.id: _left(entries, item.id, used_kind="gems_used") for item in CATALOG if item.kind == "gem"}
    return ArmoryState(
        profile_id=profile_id,
        balance=earned - spent,
        earned=earned,
        spent=spent,
        owned=owned,
        grenades=max(STARTING_GRENADES + bought_grenades - used_grenades, 0),
        ammo=ammo,
        gems=gems,
        best_survived_ms=BestSurvived(
            easy=_best_survived(entries, "easy"),
            medium=_best_survived(entries, "medium"),
            hard=_best_survived(entries, "hard"),
            insane=_best_survived(entries, "insane"),
        ),
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
    entries.extend(
        ArmoryEntry(profile_id=profile_id, kind="gems_used", item_id=item_id, points=0, quantity=used, created_at=now)
        for item_id, used in sorted(round_result.gems_used.items())
        if used > 0
    )
    if round_result.survived_ms > 0:
        entries.append(
            ArmoryEntry(
                profile_id=profile_id,
                kind="survived",
                item_id=round_result.difficulty,
                points=0,
                quantity=round_result.survived_ms,
                created_at=now,
            )
        )
    return tuple(entries)


def clamped_round(state: ArmoryState, round_result: ArmoryRoundCreate) -> ArmoryRoundCreate:
    """A round's grenades, rounds, and gem charges, capped at what the profile had;
    rounds of a bullet (or charges of a gem) it never had are dropped."""
    return ArmoryRoundCreate(
        points=round_result.points,
        grenades_used=min(round_result.grenades_used, state.grenades),
        rounds_used={
            item_id: min(used, state.ammo[item_id])
            for item_id, used in round_result.rounds_used.items()
            if item_id in state.ammo
        },
        gems_used={
            item_id: min(used, state.gems[item_id])
            for item_id, used in round_result.gems_used.items()
            if item_id in state.gems
        },
        survived_ms=round_result.survived_ms,
        difficulty=round_result.difficulty,
    )


def art_entry(state: ArmoryState, *, now: datetime) -> ArmoryEntry:
    """The ledger row paying for one piece of art, or why it can't be paid for."""
    item = catalog_item(ART_ITEM_ID)
    if item.price > state.balance:
        raise NotEnoughPointsError(item.id, item.price, state.balance)
    return ArmoryEntry(
        profile_id=state.profile_id, kind="purchased", item_id=item.id, points=item.price, quantity=1, created_at=now
    )


def purchase_entry(state: ArmoryState, item_id: str, *, now: datetime) -> ArmoryEntry:
    """The ledger row for buying `item_id`, or the reason it can't be bought."""
    item = catalog_item(item_id)
    if item.kind == "art":
        raise NotSoldHereError(item.id)
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


def _left(entries: Sequence[ArmoryEntry], item_id: str, *, used_kind: str) -> int:
    """How many of a consumable's rounds or charges are left: bought minus used, never negative."""
    bought = sum(e.quantity for e in entries if e.kind == "purchased" and e.item_id == item_id)
    used = sum(e.quantity for e in entries if e.kind == used_kind and e.item_id == item_id)
    return max(bought - used, 0)


def _best_survived(entries: Sequence[ArmoryEntry], difficulty: Difficulty) -> int:
    """The longest round on `difficulty`. Rounds from before difficulties (no item id) were medium."""
    return max(
        (e.quantity for e in entries if e.kind == "survived" and (e.item_id or "medium") == difficulty),
        default=0,
    )


def _is_grenade(item_id: str | None) -> bool:
    return any(item.id == item_id and item.kind == "grenade" for item in CATALOG)
