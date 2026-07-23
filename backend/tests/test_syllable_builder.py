"""Pure unit tests for the seed game module — PRD §6, §11: generation must be
deterministic under a fixed seed, and difficulty must be non-decreasing on the
primary axis (syllable count) as level rises."""

from random import Random

from app.games.syllable_builder import SyllableBuilderGame


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
