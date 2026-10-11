"""PRD §6, §11: deterministic under a fixed seed, facts are arithmetically true, and
difficulty moves the right way on both axes: operand ceiling up, approach time down."""

from itertools import pairwise

from app.play.games.arithmetic_reducers_pure import ALL_OPERATORS, apply_operator
from app.play.games.fact_fluency_reducers_pure import TIERS, FactFluencyGame, tier_for_level
from tests.play.play_fakes import SeededRng, int_at, list_at, str_at


def _game() -> FactFluencyGame:
    return FactFluencyGame()


def _levels() -> range:
    return range(1, _game().metadata.max_level + 1)


def _true_fact(p: dict[str, object]) -> bool:
    return apply_operator(str_at(p, "operator"), int_at(p, "left"), int_at(p, "right")) == int_at(p, "answer")


def test_generate_item_is_deterministic_under_fixed_seed() -> None:
    assert _game().generate_item(level=5, rng=SeededRng(42)) == _game().generate_item(level=5, rng=SeededRng(42))


def test_both_difficulty_axes_move_the_right_way() -> None:
    tiers = [tier_for_level(level) for level in _levels()]
    ceilings = [tier.operand_max for tier in tiers]
    approach = [tier.approach_ms for tier in tiers]
    assert ceilings == sorted(ceilings)
    assert approach == sorted(approach, reverse=True)
    for previous, current in pairwise(tiers):
        assert (
            current.operand_max > previous.operand_max
            or current.approach_ms < previous.approach_ms
            or current.operations != previous.operations
        )


def test_generated_facts_are_arithmetically_true_and_subtraction_never_negative() -> None:
    for level in _levels():
        for seed in range(20):
            p = _game().generate_item(level=level, rng=SeededRng(seed * 1000 + level)).payload
            assert _true_fact(p)
            if p["operator"] == "-":
                assert int_at(p, "right") <= int_at(p, "left")


def test_options_contain_the_answer_exactly_once_with_no_duplicates() -> None:
    for level in (1, 5, 10):
        for seed in range(20):
            p = _game().generate_item(level=level, rng=SeededRng(seed)).payload
            options = list_at(p, "options")
            assert len(options) == 4
            assert options.count(p["answer"]) == 1
            assert len(options) == len(set(map(str, options))), f"duplicate options: {options}"


def test_repeat_key_matches_the_shown_fact_and_exclude_avoids_repeats() -> None:
    p = _game().generate_item(level=5, rng=SeededRng(1)).payload
    assert _game().repeat_key(p) == f"{p['left']}{p['operator']}{p['right']}={p['answer']}"
    rng = SeededRng(7)
    key = _game().repeat_key(_game().generate_item(level=5, rng=rng).payload)
    assert key is not None
    repeats = sum(
        1
        for _ in range(20)
        if _game().repeat_key(_game().generate_item(level=5, rng=rng, exclude=frozenset({key})).payload) == key
    )
    assert repeats == 0


def test_practice_config_restricts_operators_and_respects_focus_numbers() -> None:
    rng = SeededRng(9)
    for _ in range(60):
        item = _game().generate_item_from_practice_config(
            difficulty=5, operations=["+", "-"], focus_numbers={}, rng=rng
        )
        assert item.payload["operator"] in ("+", "-")
        assert item.item_id.startswith("fact_fluency-P5-")

    rng = SeededRng(11)
    trials = 200
    hits = 0
    for _ in range(trials):
        p = (
            _game()
            .generate_item_from_practice_config(difficulty=8, operations=["×"], focus_numbers={"×": [7, 8]}, rng=rng)
            .payload
        )
        assert p["operator"] == "×"
        hits += int_at(p, "left") in (7, 8) or int_at(p, "right") in (7, 8)
    assert trials * 0.6 < hits < trials


def test_practice_config_falls_back_on_empty_operations_and_produces_true_facts() -> None:
    item = _game().generate_item_from_practice_config(difficulty=5, operations=[], focus_numbers={}, rng=SeededRng(2))
    assert item.payload["operator"] in tier_for_level(5).operations
    for seed in range(30):
        item = _game().generate_item_from_practice_config(
            difficulty=10, operations=list(ALL_OPERATORS), focus_numbers={"÷": [7]}, rng=SeededRng(seed)
        )
        assert _true_fact(item.payload)


def test_typical_level_for_age_is_below_the_operator_tier_until_its_min_age() -> None:
    operator_tier = TIERS[-1]
    for age in range(operator_tier.min_age):
        assert "×" not in tier_for_level(_game().typical_level_for_age(age)).operations
    assert _game().typical_level_for_age(operator_tier.min_age) == _game().metadata.max_level


def test_starting_level_for_age_places_older_kids_further_along_but_not_at_their_ceiling() -> None:
    assert _game().starting_level_for_age(8) <= _game().starting_level_for_age(12) < _game().typical_level_for_age(12)
    for age in range(8, 13):
        level = _game().starting_level_for_age(age)
        assert level == 1 or level - 1 == tier_for_level(level - 1).max_level
        assert "×" not in tier_for_level(level).operations


def test_promotion_into_the_operator_tier_ramps_in_multiplication_and_division_gently() -> None:
    first_level = next(tier.max_level for tier in TIERS if "×" in tier.operations)
    last_level = TIERS[-1].max_level
    assert last_level - first_level >= 2, "×/÷ needs several levels to ramp in over"

    def new_op_share(level: int) -> float:
        operators = [_game().generate_item(level=level, rng=SeededRng(seed)).payload["operator"] for seed in range(500)]
        return sum(1 for op in operators if op in ("×", "÷")) / len(operators)

    assert new_op_share(first_level) < 0.3
    assert new_op_share(last_level) > 0.4
