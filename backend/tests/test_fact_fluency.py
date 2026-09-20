"""Pure unit tests for the Fact Fluency game module — PRD §6, §11: generation
must be deterministic under a fixed seed, produced facts must be
arithmetically true, and difficulty must move the right direction on both
axes as level rises: operand ceiling up, approach time down."""

from random import Random

from app.games._arithmetic import ALL_OPERATORS
from app.games.fact_fluency import FactFluencyGame, _tier_for_level, apply_operator

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
