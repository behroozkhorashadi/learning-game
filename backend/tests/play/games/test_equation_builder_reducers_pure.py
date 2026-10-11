"""PRD §6, §11: deterministic under a fixed seed, equations are arithmetically true, and
the operand ceiling is non-decreasing with level."""

from app.play.games.arithmetic_reducers_pure import apply_operator
from app.play.games.equation_builder_reducers_pure import TIERS, EquationBuilderGame, tier_for_level
from tests.play.play_fakes import SeededRng, int_at, list_at, str_at


def _game() -> EquationBuilderGame:
    return EquationBuilderGame()


def _levels() -> range:
    return range(1, _game().metadata.max_level + 1)


def test_generate_item_is_deterministic_under_fixed_seed() -> None:
    assert _game().generate_item(level=5, rng=SeededRng(42)) == _game().generate_item(level=5, rng=SeededRng(42))


def test_operand_ceiling_is_monotonic_by_level() -> None:
    ceilings = [tier_for_level(level).operand_max for level in _levels()]
    assert ceilings == sorted(ceilings)


def test_generated_equations_are_arithmetically_true_and_allowed_by_the_tier() -> None:
    for level in _levels():
        tier = tier_for_level(level)
        for seed in range(20):
            p = _game().generate_item(level=level, rng=SeededRng(seed * 1000 + level)).payload
            assert apply_operator(str_at(p, "operator"), int_at(p, "left"), int_at(p, "right")) == int_at(p, "answer")
            assert str_at(p, "missing") in tier.missing_kinds
            assert str_at(p, "operator") in tier.operations


def test_subtraction_never_goes_negative() -> None:
    levels = [level for level in _levels() if "-" in tier_for_level(level).operations]
    assert levels, "expected at least one tier to unlock subtraction"
    for level in levels:
        for seed in range(50):
            p = _game().generate_item(level=level, rng=SeededRng(seed)).payload
            if p["operator"] == "-":
                assert int_at(p, "right") <= int_at(p, "left")
                assert int_at(p, "answer") >= 0


def test_tiles_contain_the_correct_value_exactly_once_and_no_duplicates() -> None:
    for level in (1, 5, 10):
        for seed in range(20):
            p = _game().generate_item(level=level, rng=SeededRng(seed)).payload
            tiles = list_at(p, "tiles")
            assert tiles.count(str(p[str_at(p, "missing")])) == 1
            assert len(tiles) == len(set(map(str, tiles))), f"duplicate tile labels: {tiles}"


def test_non_operator_items_offer_at_least_four_tiles_and_grow_with_level() -> None:
    """A 2-tile tray makes the blank guessable without doing the arithmetic."""
    for level in _levels():
        for seed in range(20):
            p = _game().generate_item(level=level, rng=SeededRng(seed)).payload
            if p["missing"] != "operator":
                assert len(list_at(p, "tiles")) >= 4
    low = len(list_at(_game().generate_item(level=1, rng=SeededRng(0)).payload, "tiles"))
    high = len(list_at(_game().generate_item(level=10, rng=SeededRng(0)).payload, "tiles"))
    assert high > low


def test_repeat_key_matches_the_shown_equation_and_blank() -> None:
    p = _game().generate_item(level=5, rng=SeededRng(1)).payload
    assert _game().repeat_key(p) == f"{p['left']}{p['operator']}{p['right']}={p['answer']}|{p['missing']}"


def test_typical_level_for_age_is_below_the_operator_tier_until_its_min_age() -> None:
    operator_tier = TIERS[-1]
    for age in range(operator_tier.min_age):
        assert "×" not in tier_for_level(_game().typical_level_for_age(age)).operations
    assert _game().typical_level_for_age(operator_tier.min_age) == _game().metadata.max_level


def test_starting_level_for_age_places_older_kids_further_along_but_not_at_their_ceiling() -> None:
    six = _game().starting_level_for_age(6)
    nine = _game().starting_level_for_age(9)
    assert 1 < six < _game().typical_level_for_age(6)
    assert six <= nine < _game().typical_level_for_age(9)
    for age in range(6, 12):
        level = _game().starting_level_for_age(age)
        assert level == 1 or level - 1 == tier_for_level(level - 1).max_level
        assert "×" not in tier_for_level(level).operations


def test_promotion_into_the_operator_tier_ramps_in_multiplication_and_division_gently() -> None:
    operator_tier = TIERS[-1]

    def new_op_share(level: int) -> float:
        operators = [_game().generate_item(level=level, rng=SeededRng(seed)).payload["operator"] for seed in range(500)]
        return sum(1 for op in operators if op in ("×", "÷")) / len(operators)

    assert new_op_share(operator_tier.max_level - 2) < 0.3
    assert new_op_share(operator_tier.max_level) > 0.4


def test_exclude_avoids_repeats_when_the_pool_is_effectively_unbounded() -> None:
    rng = SeededRng(7)
    key = _game().repeat_key(_game().generate_item(level=5, rng=rng).payload)
    assert key is not None
    repeats = sum(
        1
        for _ in range(20)
        if _game().repeat_key(_game().generate_item(level=5, rng=rng, exclude=frozenset({key})).payload) == key
    )
    assert repeats == 0
