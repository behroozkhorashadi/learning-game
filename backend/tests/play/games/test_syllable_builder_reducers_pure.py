"""PRD §6, §11: generation is deterministic under a fixed seed, and difficulty is
non-decreasing on the primary axis (syllable count) as level rises."""

from app.play.games.syllable_builder_reducers_pure import WORD_BANK, SyllableBuilderGame
from tests.play.play_fakes import SeededRng, list_at, str_at

# One representative level per syllable-count bucket, matching the level thresholds.
_LEVEL_FOR_SYLLABLE_COUNT = ((2, 1), (3, 4), (4, 8))

# A session shows at most this many items (SESSION_LENGTH in the frontend). Regression
# guard: the word banks used to be sized exactly at 4-5, so a session on one level was
# one item away from forcing a repeat.
_TYPICAL_SESSION_LENGTH = 5


def test_generate_item_is_deterministic_under_fixed_seed() -> None:
    game = SyllableBuilderGame()
    assert game.generate_item(level=5, rng=SeededRng(42)) == game.generate_item(level=5, rng=SeededRng(42))


def test_difficulty_is_monotonic_on_primary_axis() -> None:
    game = SyllableBuilderGame()
    counts = [
        len(list_at(game.generate_item(level=level, rng=SeededRng(7)).payload, "correct_syllables"))
        for level in range(1, game.metadata.max_level + 1)
    ]
    assert counts == sorted(counts)


def test_word_bank_pools_exceed_a_typical_session_length() -> None:
    for syllable_count, words in WORD_BANK.items():
        assert len(words) > _TYPICAL_SESSION_LENGTH, f"syllable_count={syllable_count} pool too small"


def test_no_repeat_within_session_until_pool_exhausted() -> None:
    game = SyllableBuilderGame()
    for syllable_count, level in _LEVEL_FOR_SYLLABLE_COUNT:
        words = WORD_BANK[syllable_count]
        exclude: set[str] = set()
        for _ in range(len(words)):
            item = game.generate_item(level=level, rng=SeededRng(0), exclude=frozenset(exclude))
            word = str_at(item.payload, "target_word")
            assert word not in exclude, f"word {word!r} repeated before the pool was exhausted"
            exclude.add(word)
        assert exclude == {word for word, _ in words}


def test_tiles_hold_the_syllables_plus_distractors_and_the_repeat_key_is_the_word() -> None:
    game = SyllableBuilderGame()
    item = game.generate_item(level=8, rng=SeededRng(3))
    syllables = list_at(item.payload, "correct_syllables")
    tiles = list_at(item.payload, "tiles")
    assert all(syllable in tiles for syllable in syllables)
    assert len(tiles) == len(syllables) + 4
    assert game.repeat_key(item.payload) == item.payload["target_word"]
    assert game.repeat_key({}) is None
