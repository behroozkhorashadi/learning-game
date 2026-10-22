from app.play.games.catalog_reducers_pure import game_catalog
from app.play.loop_a_reducers_pure import LevelAction, LevelDecision, WindowAttempt
from app.play.play_reducers_pure import (
    DIFFICULTY_CHANGED,
    ITEM_SHOWN,
    age_of,
    cooling_down_repeat_keys,
    difficulty_changed_event,
    loop_config_for,
    pending_confidence_item,
    shown_repeat_keys,
    window_of,
)
from app.play.play_schemas_pure import Attempt
from tests.play.play_fakes import START


def _attempt(*, correct: bool | None, score: float | None = None) -> Attempt:
    return Attempt(
        item_id="i",
        profile_id=1,
        game_id="g",
        level=1,
        correct=correct,
        score=score,
        hints_used=1,
        time_ms=900,
        created_at=START,
    )


def test_age_and_per_game_loop_tuning() -> None:
    assert age_of(2019, 2026) == 7
    tuned = loop_config_for("fact_fluency")
    assert tuned is not None
    assert (tuned.window_size, tuned.rapid_promotion_time_ms, tuned.promote_accuracy) == (3, 6000, 0.67)
    assert loop_config_for("zombie_horde") == tuned
    assert loop_config_for("syllable_builder") is None


def test_score_only_attempts_count_as_not_correct() -> None:
    assert window_of([_attempt(correct=True), _attempt(correct=None, score=0.9)]) == [
        WindowAttempt(correct=True, hints_used=1, time_ms=900),
        WindowAttempt(correct=False, hints_used=1, time_ms=900),
    ]


def test_shown_repeat_keys_read_the_nested_item_payload() -> None:
    game = game_catalog()["syllable_builder"]
    events: list[dict[str, object]] = [
        {"item_id": "a", "payload": {"target_word": "cactus"}, "pacing": "at_level"},
        {"item_id": "b", "payload": {"target_word": "monkey"}},
        {"item_id": "c"},
    ]
    assert shown_repeat_keys(game, events) == frozenset({"cactus", "monkey"})


def test_failed_equations_back_off_exponentially_and_success_clears_them() -> None:
    game = game_catalog()["equation_builder"]
    equation = {"left": 3, "operator": "+", "right": 4, "answer": 7, "missing": "answer"}
    other = {"left": 2, "operator": "+", "right": 2, "answer": 4, "missing": "answer"}
    shown = [
        {"item_id": "hard-1", "payload": equation},
        {"item_id": "other-1", "payload": other},
        {"item_id": "hard-2", "payload": equation},
        {"item_id": "other-2", "payload": other},
        {"item_id": "hard-3", "payload": equation},
    ]
    hard_key = game.repeat_key(equation)
    assert hard_key is not None

    first_failure = [{"item_id": "hard-1", "correct": False, "hints_used": 0}]
    assert cooling_down_repeat_keys(game, shown, first_failure) == frozenset({hard_key})
    after_two_others = [
        *first_failure,
        {"item_id": "other-1", "correct": True, "hints_used": 0},
        {"item_id": "other-2", "correct": True, "hints_used": 0},
    ]
    assert cooling_down_repeat_keys(game, shown, after_two_others) == frozenset()

    second_failure = [*after_two_others, {"item_id": "hard-2", "correct": False, "hints_used": 0}]
    after_two_more = [
        *second_failure,
        {"item_id": "other-1", "correct": True, "hints_used": 0},
        {"item_id": "other-2", "correct": True, "hints_used": 0},
    ]
    assert cooling_down_repeat_keys(game, shown, after_two_more) == frozenset({hard_key})

    recovered = [*after_two_more, {"item_id": "hard-3", "correct": True, "hints_used": 0}]
    assert cooling_down_repeat_keys(game, shown, recovered) == frozenset()


def test_hinted_equation_outbreak_answer_triggers_backoff() -> None:
    game = game_catalog()["fact_fluency"]
    fact = {"left": 6, "operator": "×", "right": 7, "answer": 42, "missing": "answer"}
    key = game.repeat_key(fact)
    assert key is not None
    cooling = cooling_down_repeat_keys(
        game,
        [{"item_id": "fact-1", "payload": fact}],
        [{"item_id": "fact-1", "correct": True, "hints_used": 1}],
    )
    assert cooling == frozenset({key})


def test_a_confidence_item_is_owed_only_right_after_a_support_decision() -> None:
    assert not pending_confidence_item(None)
    assert not pending_confidence_item((ITEM_SHOWN, {}))
    assert not pending_confidence_item((DIFFICULTY_CHANGED, {"needs_confidence_item": False}))
    assert pending_confidence_item((DIFFICULTY_CHANGED, {"needs_confidence_item": True}))


def test_difficulty_changed_event_carries_the_reason() -> None:
    decision = LevelDecision(
        action=LevelAction.SUPPORT,
        level=2,
        changed=True,
        reason="support",
        reset_window=True,
        needs_confidence_item=True,
        show_encouragement=True,
    )
    assert difficulty_changed_event(3, decision) == {
        "from": 3,
        "to": 2,
        "reason": "support",
        "needs_confidence_item": True,
        "show_encouragement": True,
    }
