"""Pure unit tests for the seed game module — PRD §6, §11: generation must be
deterministic under a fixed seed, and difficulty must be non-decreasing on the
primary axis (syllable count) as level rises."""

from random import Random

from app.games.syllable_builder import WORD_BANK, SyllableBuilderGame

# One representative level per syllable-count bucket, matching
# `_syllable_count_for_level`'s thresholds.
_LEVEL_FOR_SYLLABLE_COUNT = {2: 1, 3: 4, 4: 8}

# A session shows at most this many items in practice (SESSION_LENGTH in
# frontend/src/games/SyllableBuilder.tsx). Regression guard for a real bug: the
# word banks used to be sized exactly at 4-5, so a session that stayed on one
# syllable-count level was one item away from forcing a repeat.
_TYPICAL_SESSION_LENGTH = 5


def test_generate_item_is_deterministic_under_fixed_seed():
    game = SyllableBuilderGame()
    a = game.generate_item(level=5, rng=Random(42))
    b = game.generate_item(level=5, rng=Random(42))
    assert a == b


def test_difficulty_is_monotonic_on_primary_axis():
    game = SyllableBuilderGame()
    syllable_counts = [
        len(game.generate_item(level=level, rng=Random(7)).payload["correct_syllables"])
        for level in range(1, game.metadata.max_level + 1)
    ]
    assert syllable_counts == sorted(syllable_counts)


def test_word_bank_pools_exceed_a_typical_session_length():
    for syllable_count, words in WORD_BANK.items():
        assert len(words) > _TYPICAL_SESSION_LENGTH, (
            f"syllable_count={syllable_count} pool has only {len(words)} words "
            f"— a full-length session could force a same-session repeat"
        )


def test_no_repeat_within_session_until_pool_exhausted():
    """Regression test: `generate_item`'s no-repeat exclusion must not produce
    a repeat while an unseen word remains in the pool. A prior bug let this
    happen well before the pool was exhausted (see frontend fetch-guard and
    progress-counting fixes in SyllableBuilder.tsx)."""
    game = SyllableBuilderGame()
    for syllable_count, words in WORD_BANK.items():
        level = _LEVEL_FOR_SYLLABLE_COUNT[syllable_count]
        exclude: set[str] = set()
        for _ in range(len(words)):
            item = game.generate_item(level=level, rng=Random(0), exclude=frozenset(exclude))
            word = item.payload["target_word"]
            assert word not in exclude, f"word {word!r} repeated before the pool was exhausted"
            exclude.add(word)
        assert exclude == {word for word, _ in words}
