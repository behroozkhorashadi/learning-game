"""Zombie Horde's points and armory. Points are earned per round and spent in the
armory on weapons, bullets, and grenade packs.

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

ArmoryItemKind = Literal["weapon", "bullet", "grenade", "art"]
ArmoryEntryKind = Literal["earned", "purchased", "grenades_used", "rounds_used"]

# A generous ceiling on one round's points: a round is 60 seconds, so anything past
# this is a bug or a tampered request, not good play.
MAX_ROUND_POINTS = 2000
MAX_ROUND_GRENADES = 50
MAX_ROUND_SHOTS = 500

ItemId = Annotated[str, StringConstraints(min_length=1, max_length=64)]


class ArmoryItem(BaseModel):
    """One thing the armory sells. `price` 0 means every profile starts owning it.
    A `consumable` (a grenade pack, a pack of special rounds) can be bought again
    and again and adds `quantity` grenades or rounds, which get used up in play; a
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
    catalog: list[ArmoryItem]


class ArmoryRoundCreate(BaseModel):
    """A finished Zombie Horde round: the points it scored, the grenades it threw, and
    the special rounds it fired (by bullet item id)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    points: int = Field(ge=0, le=MAX_ROUND_POINTS)
    grenades_used: int = Field(ge=0, le=MAX_ROUND_GRENADES)
    rounds_used: dict[ItemId, Annotated[int, Field(ge=0, le=MAX_ROUND_SHOTS)]] = Field(default_factory=dict[str, int])


class ArmoryPurchaseCreate(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    item_id: ItemId


class ArmoryEntry(BaseModel):
    """One ledger row. `points` is what was earned or the price paid; `quantity` is
    the grenades a purchase added or a round used."""

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
