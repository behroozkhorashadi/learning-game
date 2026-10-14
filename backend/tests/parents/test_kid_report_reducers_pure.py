from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

from app.parents.kid_report_reducers_pure import (
    active_stretches,
    arithmetic_problem,
    daily_points,
    day_streak,
    fact_cells,
    game_stats,
    hour_cells,
    longest_streak,
    median,
    periods,
    read_answer,
    report_parts,
    shown_items,
    sittings,
    skill_stats,
    totals_for,
    trouble_spots,
    weekly_points,
    word_problem,
    wrong_answer_of,
)
from app.parents.parents_schemas_pure import HistoryAttempt
from tests.parents.parents_fakes import NOW, HistoryBuilder, days_ago, fact, games, kid, local, word


def attempt(**changes: object) -> HistoryAttempt:
    base = HistoryAttempt(
        game_id="syllable_builder",
        item_id="i",
        level=1,
        correct=False,
        hints_used=0,
        time_ms=1000,
        details={},
        created_at=NOW,
    )
    return replace(base, **changes)


def test_an_arithmetic_item_reads_as_the_kid_saw_it_with_the_missing_part_as_a_question_mark() -> None:
    plain = arithmetic_problem(fact(7, "×", 8, 56))
    missing_right = arithmetic_problem(fact(7, "×", 8, 56, missing="right"))
    subtraction = arithmetic_problem(fact(9, "-", 4, 5))
    assert plain is not None
    assert (plain.prompt, plain.answer, plain.fact) == ("7 × 8 = ?", "56", ("×", 7, 8))
    assert missing_right is not None
    assert (missing_right.prompt, missing_right.answer) == ("7 × ? = 56", "8")
    assert subtraction is not None
    assert subtraction.prompt == "9 \u2212 4 = ?"
    assert arithmetic_problem({"left": 1}) is None
    assert arithmetic_problem(fact(1, "^", 2, 1)) is None


def test_a_word_item_reads_as_the_word_and_its_syllables() -> None:
    problem = word_problem(word("rabbit", "rab", "bit"))
    assert problem is not None
    assert (problem.prompt, problem.answer) == ("rabbit", "rab·bit")
    assert word_problem(fact(1, "+", 1, 2)) is None


def test_shown_items_maps_item_ids_to_their_payloads_and_skips_junk() -> None:
    assert shown_items([{"item_id": "a", "payload": {"x": 1}}, {"nope": True}]) == {"a": {"x": 1}}


def test_the_wrong_answer_is_what_the_kid_built_with_tile_indexes_dropped() -> None:
    built = attempt(details={"assembled": ["bit-1", "rab-0"]})
    placed = attempt(game_id="equation_builder", details={"placement": ["+-2"]})
    assert wrong_answer_of(built) == "bit·rab"
    assert wrong_answer_of(placed) == "+"
    assert wrong_answer_of(attempt(details={"assembled": [None, "rab-0"]})) == "_·rab"
    assert wrong_answer_of(attempt(correct=True, details={"assembled": ["rab-0"]})) is None
    assert wrong_answer_of(attempt(details={"wrong_shots": 2})) is None


def test_an_answer_is_filed_under_its_skill_and_first_try_means_right_with_no_misses_first() -> None:
    items = {"m": fact(3, "×", 4, 12), "w": word("tomato", "to", "ma", "to"), "x": {}}
    mult = read_answer(attempt(game_id="fact_fluency", item_id="m", correct=True), items, games(), local)
    shot_first = read_answer(
        attempt(game_id="fact_fluency", item_id="m", correct=True, hints_used=2), items, games(), local
    )
    reading = read_answer(attempt(item_id="w"), items, games(), local)
    unknown = read_answer(attempt(game_id="pathfinder_no_way_back", item_id="x"), items, games(), local)
    assert (mult.skill, mult.skill_label, mult.area, mult.first_try) == (
        "multiplication",
        "Multiplication",
        "math",
        True,
    )
    assert shot_first.first_try is False
    assert (reading.skill, reading.skill_label, reading.area) == ("words_3", "3-syllable words", "reading")
    assert (unknown.skill, unknown.skill_label, unknown.area) == ("pathfinder_no_way_back", "Pathfinder", "puzzles")


def test_median() -> None:
    assert median([]) is None
    assert median([5, 1, 3]) == 3
    assert median([1, 2, 3, 10]) == 2


def test_active_time_skips_breaks_over_five_minutes_and_credits_the_later_game() -> None:
    start = datetime(2026, 10, 14, 9, 0, tzinfo=UTC)
    actions = [(start, "a"), (start + timedelta(minutes=2), "b"), (start + timedelta(minutes=20), "b")]
    stretches = active_stretches(actions, local)
    assert [(s.minutes, s.game_id) for s in stretches] == [(2.0, "b")]


def test_sittings_split_on_breaks_over_ten_minutes() -> None:
    start = datetime(2026, 10, 14, 9, 0, tzinfo=UTC)
    moments = [start, start + timedelta(minutes=8), start + timedelta(minutes=30)]
    assert sittings(moments) == [(start, start + timedelta(minutes=8)), (moments[2], moments[2])]


def test_day_streak_counts_back_from_today_or_yesterday() -> None:
    today = date(2026, 10, 14)
    days = {today - timedelta(days=n) for n in (1, 2, 3, 6)}
    assert day_streak(days, today) == 3
    assert day_streak(days | {today}, today) == 4
    assert day_streak({today - timedelta(days=2)}, today) == 0
    assert longest_streak(days) == 3


def test_periods_are_the_last_n_days_and_the_n_before() -> None:
    current, previous = periods(date(2026, 10, 14), 7)
    assert (current.first, current.last) == (date(2026, 10, 8), date(2026, 10, 14))
    assert (previous.first, previous.last) == (date(2026, 10, 1), date(2026, 10, 7))


def test_totals_count_answers_time_days_and_sittings_in_the_period_only() -> None:
    history = (
        HistoryBuilder()
        .answers(days_ago(1), [fact(1, "+", 1, 2)] * 3)
        .answer(days_ago(1, minute=3), fact(2, "+", 2, 4), correct=False)
        .answer(days_ago(1, minute=4), fact(2, "+", 3, 5), hints=1, ms=5000)
        .answers(days_ago(3), [fact(1, "+", 1, 2)] * 2)
        .answers(days_ago(20), [fact(1, "+", 1, 2)] * 5)
        .build()
    )
    parts = report_parts(kid(), history, games(), now=NOW, days=7, local_time=local)
    totals = totals_for(parts.current, parts.answers, parts.stretches, parts.local_actions)
    assert (totals.problems, totals.correct, totals.active_days, totals.sittings) == (7, 6, 2, 2)
    assert (totals.accuracy_pct, totals.first_try_pct) == (86, 71)
    assert totals.median_answer_ms == 3000
    assert totals.minutes == 5


def test_daily_points_cover_every_day_including_empty_ones_with_minutes_per_game() -> None:
    history = HistoryBuilder().answers(days_ago(0, hour=9), [fact(1, "+", 1, 2)] * 3).build()
    parts = report_parts(kid(), history, games(), now=NOW, days=7, local_time=local)
    points = daily_points(parts.current, parts.answers, parts.stretches)
    assert len(points) == 7
    assert points[-1].problems == 3
    assert points[-1].game_minutes == {"fact_fluency": 2}
    assert all(p.minutes == 0 for p in points[:-1])


def test_hour_cells_add_up_minutes_by_weekday_and_hour() -> None:
    history = HistoryBuilder().answers(datetime(2026, 10, 12, 16, 0, tzinfo=UTC), [fact(1, "+", 1, 2)] * 4).build()
    parts = report_parts(kid(), history, games(), now=NOW, days=7, local_time=local)
    cells = hour_cells(parts.current, parts.stretches)
    assert [(c.weekday, c.hour, c.minutes) for c in cells] == [(0, 16, 3)]


def test_skills_compare_with_the_period_before_and_judge_only_with_enough_answers() -> None:
    history = (
        HistoryBuilder()
        .answers(days_ago(10), [fact(3, "×", 4, 12)] * 8, correct=False)
        .answers(days_ago(2), [fact(3, "×", 4, 12)] * 16)
        .answers(days_ago(2, hour=18), [fact(9, "÷", 3, 3)] * 8, correct=False)
        .answers(days_ago(1), [fact(1, "+", 1, 2)] * 3)
        .build()
    )
    parts = report_parts(kid(), history, games(), now=NOW, days=7, local_time=local)
    skills = {s.key: s for s in skill_stats(parts.current, parts.previous, parts.answers)}
    assert skills["multiplication"].status == "strong"
    assert (skills["multiplication"].first_try_pct, skills["multiplication"].previous_first_try_pct) == (100, 0)
    assert skills["division"].status == "needs_work"
    assert skills["addition"].status == "new"


def test_fact_cells_count_each_fact_in_the_period() -> None:
    history = (
        HistoryBuilder()
        .answer(days_ago(1), fact(3, "×", 4, 12))
        .answer(days_ago(1, minute=1), fact(3, "×", 4, 12), hints=1)
        .build()
    )
    parts = report_parts(kid(), history, games(), now=NOW, days=7, local_time=local)
    assert [
        (c.operator, c.left, c.right, c.attempts, c.first_try) for c in fact_cells(parts.current, parts.answers)
    ] == [("×", 3, 4, 2, 1)]


def test_trouble_spots_are_problems_missed_twice_most_missed_first_with_what_they_put() -> None:
    history = (
        HistoryBuilder()
        .answers(days_ago(2), [fact(7, "×", 8, 56)] * 3, correct=False)
        .answer(days_ago(1), fact(7, "×", 8, 56))
        .answers(days_ago(1, hour=9), [fact(6, "+", 7, 13)] * 2, hints=1)
        .answer(days_ago(1, hour=10), fact(2, "+", 2, 4), correct=False)
        .wrong_word(days_ago(1, hour=11), word("rabbit", "rab", "bit"), "bit-1", "rab-0")
        .wrong_word(days_ago(1, hour=12), word("rabbit", "rab", "bit"), "rab-0", "rab-2")
        .build()
    )
    parts = report_parts(kid(), history, games(), now=NOW, days=7, local_time=local)
    spots = trouble_spots(parts.current, parts.answers, games())
    assert [(s.prompt, s.misses, s.attempts) for s in spots] == [
        ("7 × 8 = ?", 3, 4),
        ("rabbit", 2, 2),
        ("6 + 7 = ?", 2, 2),
    ]
    assert spots[1].wrong_answers == ["rab·rab", "bit·rab"]
    assert spots[0].game_title == "Equation Outbreak"
    assert spots[0].answer == "56"


def test_game_stats_carry_time_accuracy_and_the_level_path_through_the_period() -> None:
    builder = (
        HistoryBuilder()
        .answer(days_ago(20), fact(1, "+", 1, 2))
        .change(days_ago(20, minute=5), 2, 3)
        .answers(days_ago(2), [fact(1, "+", 1, 2)] * 4)
        .change(days_ago(2, minute=10), 3, 4)
        .change(days_ago(1), 4, 5)
        .answers(days_ago(1, hour=9), [word("cat", "cat")] * 2, game_id="syllable_builder")
    )
    builder.ratings.append(("fact_fluency", 5))
    builder.ratings.append(("fact_fluency", 4))
    builder.completions.extend([days_ago(30), days_ago(1, hour=20)])
    history = builder.build()
    parts = report_parts(kid(), history, games(), now=NOW, days=7, local_time=local)
    stats = {g.game_id: g for g in game_stats(parts.current, parts.answers, parts.stretches, history, games(), local)}
    outbreak = stats["fact_fluency"]
    assert (outbreak.level, outbreak.max_level, outbreak.levels_gained) == (5, 12, 2)
    assert [p.level for p in outbreak.level_history] == [3, 4, 5]
    assert (outbreak.problems, outbreak.rating, outbreak.area) == (4, 4.5, "math")
    assert stats["pathfinder_no_way_back"].note == "1 puzzle solved (2 all time)"
    assert stats["pathfinder_no_way_back"].level is None


def test_weekly_points_cover_twelve_weeks_with_math_and_reading_separately() -> None:
    history = (
        HistoryBuilder()
        .answers(days_ago(1), [fact(1, "+", 1, 2)] * 2)
        .answer(days_ago(1, hour=9), fact(1, "+", 1, 2), correct=False)
        .answer(days_ago(1, hour=10), word("cat", "cat"), game_id="syllable_builder")
        .build()
    )
    parts = report_parts(kid(), history, games(), now=NOW, days=7, local_time=local)
    weeks = weekly_points(parts.today, parts.answers, parts.stretches)
    assert len(weeks) == 12
    assert weeks[-1].week_start == date(2026, 10, 12)
    assert (weeks[-1].math_first_try_pct, weeks[-1].reading_first_try_pct, weeks[-1].problems) == (67, 100, 4)
    assert weeks[0].problems == 0
    assert weeks[0].math_first_try_pct is None
