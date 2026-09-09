"""Pure unit tests for the Equation Builder game module — PRD §6, §11:
generation must be deterministic under a fixed seed, produced equations must
actually be arithmetically true, and difficulty must be non-decreasing on the
primary axis (operand ceiling) as level rises."""

from random import Random

from app.games.equation_builder import EquationBuilderGame, _apply, _tier_for_level

GAME = EquationBuilderGame()


def test_generate_item_is_deterministic_under_fixed_seed():
    a = GAME.generate_item(level=5, rng=Random(42))
    b = GAME.generate_item(level=5, rng=Random(42))
    assert a == b


def test_operand_ceiling_is_monotonic_by_level():
    ceilings = [_tier_for_level(level).operand_max for level in range(1, GAME.metadata.max_level + 1)]
    assert ceilings == sorted(ceilings)


def test_generated_equations_are_arithmetically_true():
    for level in range(1, GAME.metadata.max_level + 1):
        for seed in range(20):
            item = GAME.generate_item(level=level, rng=Random(seed * 1000 + level))
            payload = item.payload
            assert _apply(payload["operator"], payload["left"], payload["right"]) == payload["answer"]


def test_subtraction_never_goes_negative():
    tier_levels_with_subtraction = [level for level in range(1, GAME.metadata.max_level + 1) if "-" in _tier_for_level(level).operations]
    assert tier_levels_with_subtraction, "expected at least one tier to unlock subtraction"
    for level in tier_levels_with_subtraction:
        for seed in range(50):
            item = GAME.generate_item(level=level, rng=Random(seed))
            if item.payload["operator"] == "-":
                assert item.payload["right"] <= item.payload["left"]
                assert item.payload["answer"] >= 0


def test_missing_kind_is_always_one_the_tier_allows():
    for level in range(1, GAME.metadata.max_level + 1):
        tier = _tier_for_level(level)
        for seed in range(20):
            item = GAME.generate_item(level=level, rng=Random(seed))
            assert item.payload["missing"] in tier.missing_kinds
            assert item.payload["operator"] in tier.operations


def test_tiles_contain_the_correct_value_exactly_once_and_no_duplicates():
    for level in (1, 5, 10):
        for seed in range(20):
            item = GAME.generate_item(level=level, rng=Random(seed))
            payload = item.payload
            correct = str(payload[payload["missing"]])
            tiles = payload["tiles"]
            assert tiles.count(correct) == 1
            assert len(tiles) == len(set(tiles)), f"duplicate tile labels: {tiles}"


def test_non_operator_items_offer_at_least_four_tiles():
    """A 2-tile tray (1 correct + 1 distractor) makes the blank guessable
    without doing the arithmetic — regression guard for that."""
    for level in range(1, GAME.metadata.max_level + 1):
        for seed in range(20):
            item = GAME.generate_item(level=level, rng=Random(seed))
            if item.payload["missing"] == "operator":
                continue  # only 3 operators exist in total; see the docstring in _build_tiles
            assert len(item.payload["tiles"]) >= 4


def test_distractor_count_grows_with_level():
    low_level_tiles = len(GAME.generate_item(level=1, rng=Random(0)).payload["tiles"])
    high_level_tiles = len(GAME.generate_item(level=10, rng=Random(0)).payload["tiles"])
    assert high_level_tiles > low_level_tiles


def test_repeat_key_matches_the_shown_equation_and_blank():
    item = GAME.generate_item(level=5, rng=Random(1))
    key = GAME.repeat_key(item.payload)
    p = item.payload
    assert key == f"{p['left']}{p['operator']}{p['right']}={p['answer']}|{p['missing']}"


def test_exclude_avoids_repeats_when_the_pool_is_effectively_unbounded():
    """Regression guard: the retry loop must actually consult `exclude` rather
    than ignoring it — unlike syllable_builder's small curated word bank,
    equation space is large, so a single excluded key should essentially never
    survive across many draws."""
    rng = Random(7)
    first = GAME.generate_item(level=5, rng=rng)
    key = GAME.repeat_key(first.payload)
    repeats = sum(
        1 for _ in range(20) if GAME.repeat_key(GAME.generate_item(level=5, rng=rng, exclude=frozenset({key})).payload) == key
    )
    assert repeats == 0
