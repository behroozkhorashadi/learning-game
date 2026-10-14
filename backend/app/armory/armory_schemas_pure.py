"""Zombie Horde's points and armory. Points are earned per round and spent in the
armory on weapons, bullets, grenade packs, armor gems, armor upgrades, and skins.

Nothing is mutated and reconstructed: every earn, purchase, and grenade use is one
`ArmoryEntry` in a per-profile ledger, and the balance, what's owned, and how many
grenades are left are all derived from it (`armory_reducers_pure.summarize`).

The catalog's ids, names, and prices are the server's, so a purchase is checked
against prices the client can't change. What an item *does* in play (damage, fire
rate, blast radius) is the client's (frontend/src/horde/horde_armory.pure.lib.ts).
"""

from dataclasses import dataclass
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints

ArmoryItemKind = Literal["weapon", "bullet", "grenade", "gem", "upgrade", "skin", "art"]
ArmoryEntryKind = Literal["earned", "purchased", "grenades_used", "rounds_used", "gems_used", "survived"]
# How hard a round was played: how fast the horde comes, and how far its points go.
# Each keeps its own personal best.
Difficulty = Literal["easy", "medium", "hard", "insane"]

# A generous ceiling on one round: a round is 60 seconds plus overtime, where the
# zombies keep speeding up until they get through, so it can't last much past a few
# minutes. Anything past these is a bug or a tampered request, not good play.
MAX_ROUND_POINTS = 10_000
MAX_ROUND_MS = 30 * 60 * 1000
MAX_ROUND_GRENADES = 50
MAX_ROUND_SHOTS = 500
MAX_ROUND_GEM_CHARGES = 50

ItemId = Annotated[str, StringConstraints(min_length=1, max_length=64)]


class ArmoryItem(BaseModel):
    """One thing the armory sells. `price` 0 means every profile starts owning it.
    A `consumable` (a grenade pack, a pack of special rounds, an armor gem) can be
    bought again and again and adds `quantity` grenades, rounds, or gem charges (one
    charge reflects one throw or blocks one hit), which get used up in play; a
    weapon is bought once. `requires` names an item that must be owned first (the
    next weapon tier needs the one before it)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: ItemId
    kind: ArmoryItemKind
    name: str
    description: str
    price: int = Field(ge=0)
    quantity: int = Field(ge=1)
    consumable: bool
    requires: ItemId | None


class BestSurvived(BaseModel):
    """The longest round (ms) on each difficulty; 0 before the first."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    easy: int = Field(ge=0)
    medium: int = Field(ge=0)
    hard: int = Field(ge=0)
    insane: int = Field(ge=0)


class ArmoryState(BaseModel):
    """Everything the armory screen and a round's loadout need, in one response."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    profile_id: int
    balance: int
    earned: int
    spent: int
    owned: list[str]
    grenades: int
    ammo: dict[str, int]
    """Special rounds left, by bullet item id. Standard rounds never run out."""
    gems: dict[str, int]
    """Armor gem charges left, by gem item id. Every charge is worn into every round."""
    best_survived_ms: BestSurvived
    """The longest a round of this profile's has lasted on each difficulty: its personal bests."""
    catalog: list[ArmoryItem]


class ArmoryRoundCreate(BaseModel):
    """A finished Zombie Horde round: the points it scored, the grenades it threw, the
    special rounds it fired (by bullet item id), the armor gem charges it used (by gem
    item id), how long it lasted, and on which difficulty."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    points: int = Field(ge=0, le=MAX_ROUND_POINTS)
    grenades_used: int = Field(ge=0, le=MAX_ROUND_GRENADES)
    rounds_used: dict[ItemId, Annotated[int, Field(ge=0, le=MAX_ROUND_SHOTS)]] = Field(default_factory=dict[str, int])
    gems_used: dict[ItemId, Annotated[int, Field(ge=0, le=MAX_ROUND_GEM_CHARGES)]] = Field(
        default_factory=dict[str, int]
    )
    survived_ms: int = Field(default=0, ge=0, le=MAX_ROUND_MS)
    difficulty: Difficulty = "medium"


class ArmoryPurchaseCreate(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    item_id: ItemId


class ArmoryEntry(BaseModel):
    """One ledger row. `points` is what was earned or the price paid; `quantity` is
    the grenades, rounds, or gem charges a purchase added or a round used, or how long
    a round lasted (ms). A `survived` row's `item_id` is the round's difficulty (none
    before there were difficulties: those rounds were played at today's medium)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    profile_id: int
    kind: ArmoryEntryKind
    item_id: str | None
    points: int = Field(ge=0)
    quantity: int = Field(ge=0)
    created_at: AwareDatetime


ArtStyle = Literal["zombie_slayer", "comic_hero", "pixel_hero", "space_ranger"]
MAX_ART_IDEA_LENGTH = 120
# A 5 MB picture as a base64 data URL, plus its header.
MAX_ART_DATA_URL_LENGTH = 7_000_100


@dataclass(frozen=True)
class ArtPicture:
    """Decoded picture bytes: a PNG or JPEG."""

    content: bytes
    content_type: str


class ArtCreate(BaseModel):
    """A selfie (a PNG or JPEG data URL) and how to turn it into art."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    image_data_url: Annotated[str, StringConstraints(min_length=1, max_length=MAX_ART_DATA_URL_LENGTH)]
    style: ArtStyle
    idea: Annotated[str, StringConstraints(strip_whitespace=True, max_length=MAX_ART_IDEA_LENGTH)] = ""


class ArtPiece(BaseModel):
    """One piece made in the art studio, kept in the profile's gallery."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: Annotated[str, StringConstraints(min_length=1, max_length=64)]
    profile_id: int
    image_url: str
    style: ArtStyle
    idea: str
    created_at: AwareDatetime


class ArtResult(BaseModel):
    """The new piece, and the armory after paying for it."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    piece: ArtPiece
    armory: ArmoryState
