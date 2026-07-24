"""Syllable Builder: the seed game module — PRD §7.1.

Digital version of the physical syllable-card game: the kid assembles a target
word from syllable tiles (correct syllables plus distractors). The primary
difficulty axis is the target word's syllable count, which rises monotonically
with level. Word bank is a fixed, curated list (PRD §14.5 leaves curate-vs-generate
open; a fixed list is fine for this stub).
"""

from random import Random
from typing import Any, Optional

from app.games.base import GameModule
from app.games.registry import register
from app.models.game import GameMetadata
from app.models.item import Item

WORD_BANK: dict[int, list[tuple[str, list[str]]]] = {
    2: [
        ("cactus", ["cac", "tus"]),
        ("monkey", ["mon", "key"]),
        ("rabbit", ["rab", "bit"]),
        ("candle", ["can", "dle"]),
        ("pencil", ["pen", "cil"]),
        ("turtle", ["tur", "tle"]),
        ("napkin", ["nap", "kin"]),
        ("wagon", ["wag", "on"]),
        ("basket", ["bas", "ket"]),
    ],
    3: [
        ("elephant", ["el", "e", "phant"]),
        ("computer", ["com", "pu", "ter"]),
        ("dinosaur", ["di", "no", "saur"]),
        ("butterfly", ["but", "ter", "fly"]),
        ("umbrella", ["um", "brel", "la"]),
        ("banana", ["ba", "na", "na"]),
        ("octopus", ["oc", "to", "pus"]),
        ("tomato", ["to", "ma", "to"]),
        ("gorilla", ["go", "ril", "la"]),
    ],
    4: [
        ("alligator", ["al", "li", "ga", "tor"]),
        ("helicopter", ["hel", "i", "cop", "ter"]),
        ("watermelon", ["wa", "ter", "mel", "on"]),
        ("caterpillar", ["ca", "ter", "pil", "lar"]),
        ("escalator", ["es", "ca", "la", "tor"]),
        ("vegetable", ["veg", "e", "ta", "ble"]),
        ("television", ["tel", "e", "vi", "sion"]),
    ],
}

_ALL_SYLLABLES = sorted(
    {syl for words in WORD_BANK.values() for _, syllables in words for syl in syllables}
)

# (max_level_inclusive, syllable_count) — explicit and monotonic by construction.
_LEVEL_THRESHOLDS: list[tuple[int, int]] = [(3, 2), (7, 3), (10, 4)]


def _syllable_count_for_level(level: int) -> int:
    for max_level, count in _LEVEL_THRESHOLDS:
        if level <= max_level:
            return count
    return _LEVEL_THRESHOLDS[-1][1]


class SyllableBuilderGame(GameModule):
    metadata = GameMetadata(
        id="syllable_builder",
        title="Syllable Builder",
        tagline="Slide the sounds",
        skill_ids=["phonics"],
        min_age=5,
        max_age=8,
        icon="\U0001f9e9",
        max_level=10,
    )

    def generate_item(self, level: int, rng: Random, exclude: frozenset[str] = frozenset()) -> Item:
        syllable_count = _syllable_count_for_level(level)
        pool = WORD_BANK[syllable_count]
        # Fall back to the full pool once every word at this syllable count has
        # already been shown this session, rather than refusing to produce an item.
        available = [pair for pair in pool if pair[0] not in exclude] or pool
        word, syllables = rng.choice(available)

        distractor_pool = [s for s in _ALL_SYLLABLES if s not in syllables]
        distractor_count = min(2 + level // 4, len(distractor_pool))
        distractors = rng.sample(distractor_pool, distractor_count)

        tiles = list(syllables) + distractors
        rng.shuffle(tiles)

        item_id = f"{self.metadata.id}-L{level}-{rng.getrandbits(32):08x}"
        return Item(
            item_id=item_id,
            game_id=self.metadata.id,
            level=level,
            payload={
                "target_word": word,
                "correct_syllables": syllables,
                "tiles": tiles,
            },
        )

    def repeat_key(self, item_payload: dict[str, Any]) -> Optional[str]:
        return item_payload.get("target_word")


register(SyllableBuilderGame())
