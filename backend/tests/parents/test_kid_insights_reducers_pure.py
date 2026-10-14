from datetime import UTC, datetime

from app.parents.kid_insights_reducers_pure import build_report, kid_summary
from app.parents.parents_schemas_pure import BadgeEarned, Insight, KidHistory
from tests.parents.parents_fakes import NOW, HistoryBuilder, days_ago, fact, games, kid, local


def report(history: KidHistory, days: int = 7) -> list[Insight]:
    return build_report(kid(), history, games(), now=NOW, days=days, local_time=local).insights


def titles(history: KidHistory, days: int = 7) -> list[str]:
    return [i.title for i in report(history, days)]


def test_a_kid_who_never_played_gets_one_quiet_note() -> None:
    assert [(i.tone, i.title) for i in report(HistoryBuilder().build())] == [("info", "Hasn't played yet")]


def test_no_play_for_three_days_is_flagged() -> None:
    history = HistoryBuilder().answers(days_ago(4), [fact(1, "+", 1, 2)] * 2).build()
    assert "No play in 4 days" in titles(history)
    assert "No play in 2 days" not in titles(HistoryBuilder().answers(days_ago(2), [fact(1, "+", 1, 2)]).build())


def test_a_weak_skill_needs_practice_and_a_strong_one_is_celebrated() -> None:
    history = (
        HistoryBuilder()
        .answers(days_ago(1), [fact(9, "÷", 3, 3)] * 8, correct=False)
        .answers(days_ago(1, hour=9), [fact(2, "+", 2, 4)] * 15)
        .build()
    )
    found = {i.title: i for i in report(history)}
    assert found["Division needs practice"].tone == "attention"
    assert found["Division needs practice"].detail == "Right on the first try 0% of the time across 8 problems."
    assert found["Strong at addition"].tone == "celebrate"


def test_trends_against_the_period_before() -> None:
    history = (
        HistoryBuilder()
        .answers(days_ago(10), [fact(3, "×", 4, 12)] * 4, correct=False)
        .answers(days_ago(10, hour=9), [fact(3, "×", 4, 12)] * 4, ms=6000)
        .answers(days_ago(1), [fact(3, "×", 4, 12)] * 9, ms=3000)
        .answers(days_ago(1, hour=9), [fact(3, "×", 4, 12)] * 1, correct=False)
        .build()
    )
    found = {i.title: i for i in report(history)}
    assert found["Improving at multiplication"].detail == "First-try accuracy went from 50% to 90%."
    assert found["Faster at multiplication"].detail == "Typical right answer now takes 3.0s, down from 6.0s."


def test_a_problem_missed_three_times_is_a_headline_with_its_answer() -> None:
    history = HistoryBuilder().answers(days_ago(1), [fact(7, "×", 8, 56)] * 3, correct=False).build()
    found = report(history)[0]
    assert (found.tone, found.title) == ("attention", "Keeps missing 7 × 8 = ?")
    assert found.detail == "Missed 3 of 3 times in Equation Outbreak. The answer is 56."


def test_levels_climbed_and_a_game_still_finding_their_level() -> None:
    history = (
        HistoryBuilder()
        .answers(days_ago(2), [fact(1, "+", 1, 2)] * 2, ms=1000)
        .change(days_ago(2, minute=5), 1, 2)
        .change(days_ago(2, minute=6), 2, 3)
        .change(days_ago(2, minute=7), 3, 2)
        .change(days_ago(2, minute=8), 2, 3)
        .change(days_ago(2, minute=9), 3, 2)
        .change(days_ago(1), 2, 3)
        .build()
    )
    found = {i.title: i for i in report(history)}
    assert found["Up 2 levels in Equation Outbreak"].detail == "Now at level 3 of 12."
    assert found["Equation Outbreak is finding their level"].detail == (
        "It stepped up 4 times and eased off 2 times after misses. They're working around level 3."
    )


def test_steady_play_and_more_time_than_before() -> None:
    builder = HistoryBuilder()
    for day in range(5):
        builder.answers(days_ago(day), [fact(1, "+", 1, 2)] * 6)
    builder.answers(days_ago(9), [fact(1, "+", 1, 2)] * 1)
    assert "Played 5 of the last 7 days" in titles(builder.build())
    many = (
        HistoryBuilder()
        .answers(days_ago(10), [fact(1, "+", 1, 2)] * 22)
        .answers(days_ago(1), [fact(1, "+", 1, 2)] * 60)
    )
    assert "Playing more than before" in titles(many.build())


def test_attention_comes_first_then_wins_then_notes() -> None:
    history = (
        HistoryBuilder()
        .answers(days_ago(4), [fact(9, "÷", 3, 3)] * 8, correct=False)
        .answers(days_ago(4, hour=9), [fact(2, "+", 2, 4)] * 15)
        .build()
    )
    tones = [i.tone for i in report(history)]
    assert tones == sorted(tones, key=["attention", "celebrate", "info"].index)


def test_the_report_carries_streaks_badges_newest_first_and_age() -> None:
    builder = HistoryBuilder().answers(days_ago(0), [fact(1, "+", 1, 2)]).answers(days_ago(1), [fact(1, "+", 1, 2)])
    builder.badges.extend(
        [
            BadgeEarned(name="Old", tier="bronze", awarded_at=datetime(2026, 9, 1, tzinfo=UTC)),
            BadgeEarned(name="New", tier="gold", awarded_at=datetime(2026, 10, 13, tzinfo=UTC)),
        ]
    )
    built = build_report(kid(), builder.build(), games(), now=NOW, days=30, local_time=local)
    assert (built.age, built.range_days, built.day_streak, built.longest_streak) == (7, 30, 2, 2)
    assert [b.name for b in built.badges] == ["New", "Old"]
    assert len(built.daily) == 30


def test_the_summary_is_the_last_seven_days_with_the_top_finding() -> None:
    history = HistoryBuilder().answers(days_ago(1), [fact(7, "×", 8, 56)] * 3, correct=False).build()
    summary = kid_summary(build_report(kid(), history, games(), now=NOW, days=7, local_time=local))
    assert (summary.problems_7d, summary.first_try_pct_7d, summary.active_days_7d) == (3, 0, 1)
    assert len(summary.daily_minutes_7d) == 7
    assert summary.headline is not None
    assert summary.headline.title == "Keeps missing 7 × 8 = ?"
    assert summary.attention_count >= 1
