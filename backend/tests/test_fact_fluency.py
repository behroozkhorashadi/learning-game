"""Pure unit tests for the Fact Fluency game module — PRD §6, §11: generation
must be deterministic under a fixed seed, produced facts must be
arithmetically true, and difficulty must move the right direction on both
axes as level rises: operand ceiling up, approach time down."""

from random import Random

from app.games._arithmetic import ALL_OPERATORS
from app.games.fact_fluency import FactFluencyGame, _tier_for_level, _TIERS, apply_operator

GAME = FactFluencyGame()


def test_generate_item_is_deterministic_under_fixed_seed():
    a = GAME.generate_item(level=5, rng=Random(42))
    b = GAME.generate_item(level=5, rng=Random(42))
    assert a == b


def test_operand_ceiling_is_monotonic_non_decreasing_by_level():
    ceilings = [_tier_for_level(level).operand_max for level in range(1, GAME.metadata.max_level + 1)]
    assert ceilings == sorted(ceilings)


def test_approach_time_is_monotonic_non_increasing_by_level():
    """Difficulty's time-pressure axis: higher level means less time, since
    the server (not the client) owns pacing (PRD §6)."""
    approach_times = [_tier_for_level(level).approach_ms for level in range(1, GAME.metadata.max_level + 1)]
    assert approach_times == sorted(approach_times, reverse=True)


def test_every_level_increases_fact_or_time_difficulty():
    tiers = [_tier_for_level(level) for level in range(1, GAME.metadata.max_level + 1)]
    for previous, current in zip(tiers, tiers[1:]):
        assert (
            current.operand_max > previous.operand_max
            or current.approach_ms < previous.approach_ms
            or current.operations != previous.operations
        )


def test_generated_facts_are_arithmetically_true():
    for level in range(1, GAME.metadata.max_level + 1):
        for seed in range(20):
            item = GAME.generate_item(level=level, rng=Random(seed * 1000 + level))
            payload = item.payload
            assert apply_operator(payload["operator"], payload["left"], payload["right"]) == payload["answer"]


def test_subtraction_never_goes_negative():
    levels_with_subtraction = [level for level in range(1, GAME.metadata.max_level + 1) if "-" in _tier_for_level(level).operations]
    assert levels_with_subtraction, "expected at least one tier to unlock subtraction"
    for level in levels_with_subtraction:
        for seed in range(50):
            item = GAME.generate_item(level=level, rng=Random(seed))
            if item.payload["operator"] == "-":
                assert item.payload["right"] <= item.payload["left"]
                assert item.payload["answer"] >= 0


def test_options_contain_the_answer_exactly_once_with_no_duplicates():
    for level in (1, 5, 10):
        for seed in range(20):
            item = GAME.generate_item(level=level, rng=Random(seed))
            options = item.payload["options"]
            assert len(options) == 4
            assert options.count(item.payload["answer"]) == 1
            assert len(options) == len(set(options)), f"duplicate options: {options}"


def test_repeat_key_matches_the_shown_fact():
    item = GAME.generate_item(level=5, rng=Random(1))
    key = GAME.repeat_key(item.payload)
    p = item.payload
    assert key == f"{p['left']}{p['operator']}{p['right']}={p['answer']}"


def test_exclude_avoids_repeats_when_the_pool_is_effectively_unbounded():
    rng = Random(7)
    first = GAME.generate_item(level=5, rng=rng)
    key = GAME.repeat_key(first.payload)
    repeats = sum(
        1 for _ in range(20) if GAME.repeat_key(GAME.generate_item(level=5, rng=rng, exclude=frozenset({key})).payload) == key
    )
    assert repeats == 0


def test_generate_item_from_practice_config_restricts_operators():
    rng = Random(9)
    for _ in range(60):
        item = GAME.generate_item_from_practice_config(
            difficulty=5, operations=["+", "-"], focus_numbers={}, rng=rng
        )
        assert item.payload["operator"] in ("+", "-")


def test_generate_item_from_practice_config_respects_focus_numbers():
    rng = Random(11)
    hits = 0
    trials = 200
    for _ in range(trials):
        item = GAME.generate_item_from_practice_config(
            difficulty=8, operations=["×"], focus_numbers={"×": [7, 8]}, rng=rng
        )
        assert item.payload["operator"] == "×"
        if item.payload["left"] in (7, 8) or item.payload["right"] in (7, 8):
            hits += 1
    assert trials * 0.6 < hits < trials


def test_generate_item_from_practice_config_falls_back_on_empty_operations():
    item = GAME.generate_item_from_practice_config(difficulty=5, operations=[], focus_numbers={}, rng=Random(2))
    assert item.payload["operator"] in _tier_for_level(5).operations


def test_generate_item_from_practice_config_produces_true_facts():
    for seed in range(30):
        item = GAME.generate_item_from_practice_config(
            difficulty=10, operations=list(ALL_OPERATORS), focus_numbers={"÷": [7]}, rng=Random(seed)
        )
        p = item.payload
        assert apply_operator(p["operator"], p["left"], p["right"]) == p["answer"]


def test_typical_level_for_age_is_below_the_operator_tier_until_its_min_age():
    """`typical_level_for_age` only paces promotion (it is not a ceiling), but
    it should still mark ×/÷ as beyond-typical for a kid younger than the
    operator tier's `min_age`, so reaching it takes longer streaks."""
    operator_tier = _TIERS[-1]
    for age in range(operator_tier.min_age):
        typical = GAME.typical_level_for_age(age)
        assert "×" not in _tier_for_level(typical).operations

    assert GAME.typical_level_for_age(operator_tier.min_age) == GAME.metadata.max_level


def test_starting_level_for_age_places_older_kids_further_along_but_not_at_their_ceiling():
    """PRD §4: age is the base difficulty is calibrated from. A brand-new
    profile shouldn't grind through tiers clearly below their developmental
    level, but shouldn't skip straight to the hardest tier they've unlocked
    either — it starts one tier short of that ceiling, still having to earn
    the top tier through a real promotion ("slowly probe, don't jump" applies
    to the starting point too), mirroring equation_builder's identical rule."""
    eight = GAME.starting_level_for_age(8)
    twelve = GAME.starting_level_for_age(12)

    assert eight <= twelve < GAME.typical_level_for_age(12)

    # Always the entry level of some tier, never partway/at the end of one.
    for age in range(8, 13):
        level = GAME.starting_level_for_age(age)
        assert level == 1 or level - 1 == _tier_for_level(level - 1).max_level

    # No age starts a brand-new profile already inside the ×/÷ tier.
    for age in range(8, 13):
        level = GAME.starting_level_for_age(age)
        assert "×" not in _tier_for_level(level).operations


def test_promotion_into_the_operator_tier_ramps_in_multiplication_and_division_gently():
    """A kid promoted into the tier that first introduces ×/÷ must not be
    dropped straight into it at full blast on that tier's very first level —
    the ramp mechanism (test_arithmetic.py) applies here regardless of age."""
    # The tiers are single-level rungs, so the ramp runs across the whole
    # band of rungs that has ×/÷, from the first level that adds them.
    first_level = next(tier.max_level for tier in _TIERS if "×" in tier.operations)
    last_level = _TIERS[-1].max_level
    assert last_level - first_level >= 2, "×/÷ needs several levels to ramp in over"

    def new_op_share(level: int) -> float:
        operators = [GAME.generate_item(level=level, rng=Random(seed)).payload["operator"] for seed in range(500)]
        return sum(1 for op in operators if op in ("×", "÷")) / len(operators)

    assert new_op_share(first_level) < 0.3
    assert new_op_share(last_level) > 0.4
