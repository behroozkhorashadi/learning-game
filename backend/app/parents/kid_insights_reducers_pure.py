"""Plain-language findings for a parent, read off the report's numbers: what's going
well, what to keep an eye on, and what's simply worth knowing. Each rule is small and
conservative (a minimum number of answers before a skill is judged, a minimum change
before it's called a trend), so a quiet week doesn't produce alarming headlines.

Also assembles the full `KidReport` and the overview's `KidSummary` from the parts in
`kid_report_reducers_pure`.
"""

from collections.abc import Mapping, Sequence
from datetime import datetime
from types import MappingProxyType

from app.parents.kid_report_reducers_pure import (
    MAX_BADGES,
    MIN_SKILL_ANSWERS,
    LocalTime,
    ReportParts,
    daily_points,
    day_streak,
    fact_cells,
    game_stats,
    hour_cells,
    last_played_at,
    longest_streak,
    played_days,
    report_parts,
    skill_stats,
    totals_for,
    trouble_spots,
    weekly_points,
)
from app.parents.parents_schemas_pure import (
    GameInfo,
    GameStat,
    Insight,
    Kid,
    KidHistory,
    KidReport,
    KidSummary,
    PeriodTotals,
    SkillStat,
    Tone,
    TroubleSpot,
)

IDLE_DAYS = 3
# Percentage points of first-try change that count as a real move.
TREND_POINTS = 10
# A faster median answer by at least this share counts as "getting faster".
FASTER_SHARE = 0.15
SLOWER_SHARE = 0.25
LEVELS_WORTH_NOTING = 2
EASED_OFF_TIMES = 2
TIME_CHANGE_SHARE = 0.4
TIME_CHANGE_MIN_MINUTES = 20
STEADY_DAYS_SHARE = 0.6
STEADY_MIN_DAYS = 3
TROUBLE_HEADLINE_MISSES = 3
FAVORITE_SHARE = 0.5
MAX_INSIGHTS = 10
SUMMARY_DAYS = 7
TONE_ORDER: Mapping[Tone, int] = MappingProxyType({"attention": 0, "celebrate": 1, "info": 2})


def seconds(ms: int) -> str:
    return f"{ms / 1000:.1f}s"


def plural(count: int, word: str) -> str:
    return f"{count} {word}{'' if count == 1 else 's'}"


def idle_insight(parts: ReportParts, last: datetime | None) -> Insight | None:
    if last is None:
        return Insight(tone="info", title="Hasn't played yet", detail="Nothing to show until the first game.")
    days = (parts.today - parts.local_time(last).date()).days
    if days < IDLE_DAYS:
        return None
    return Insight(
        tone="attention",
        title=f"No play in {days} days",
        detail="A short session together can help get the habit going again.",
    )


def skill_insights(skills: Sequence[SkillStat]) -> list[Insight]:
    found: list[Insight] = []
    for skill in skills:
        now, before = skill.first_try_pct, skill.previous_first_try_pct
        if skill.status == "needs_work" and now is not None:
            found.append(
                Insight(
                    tone="attention",
                    title=f"{skill.label} needs practice",
                    detail=f"Right on the first try {now}% of the time across {plural(skill.problems, 'problem')}.",
                    skill=skill.key,
                )
            )
        elif skill.status == "strong" and now is not None:
            found.append(
                Insight(
                    tone="celebrate",
                    title=f"Strong at {skill.label.lower()}",
                    detail=f"{now}% right on the first try across {plural(skill.problems, 'problem')}.",
                    skill=skill.key,
                )
            )
        if now is not None and before is not None and skill.problems >= MIN_SKILL_ANSWERS:
            if now - before >= TREND_POINTS:
                found.append(
                    Insight(
                        tone="celebrate",
                        title=f"Improving at {skill.label.lower()}",
                        detail=f"First-try accuracy went from {before}% to {now}%.",
                        skill=skill.key,
                    )
                )
            elif before - now >= TREND_POINTS:
                found.append(
                    Insight(
                        tone="attention",
                        title=f"{skill.label} slipped",
                        detail=f"First-try accuracy dropped from {before}% to {now}%. Harder problems can do this.",
                        skill=skill.key,
                    )
                )
        found.extend(speed_insight(skill))
    return found


def speed_insight(skill: SkillStat) -> list[Insight]:
    now, before = skill.median_answer_ms, skill.previous_median_answer_ms
    if now is None or before is None or before == 0:
        return []
    change = (before - now) / before
    if change >= FASTER_SHARE:
        return [
            Insight(
                tone="celebrate",
                title=f"Faster at {skill.label.lower()}",
                detail=f"Typical right answer now takes {seconds(now)}, down from {seconds(before)}.",
                skill=skill.key,
            )
        ]
    if -change >= SLOWER_SHARE:
        return [
            Insight(
                tone="info",
                title=f"Taking longer on {skill.label.lower()}",
                detail=f"Typical right answer takes {seconds(now)}, up from {seconds(before)}.",
                skill=skill.key,
            )
        ]
    return []


def level_insights(games: Sequence[GameStat], parts: ReportParts) -> list[Insight]:
    found: list[Insight] = []
    for game in games:
        if game.level is not None and game.max_level is not None and game.levels_gained >= LEVELS_WORTH_NOTING:
            found.append(
                Insight(
                    tone="celebrate",
                    title=f"Up {game.levels_gained} levels in {game.title}",
                    detail=f"Now at level {game.level} of {game.max_level}.",
                    game_id=game.game_id,
                )
            )
        moves = [
            change
            for change in parts.history.level_changes
            if change.game_id == game.game_id and parts.current.holds(parts.local_time(change.at).date())
        ]
        eased = sum(1 for change in moves if change.after < change.before)
        if eased >= EASED_OFF_TIMES and game.level is not None:
            found.append(
                Insight(
                    tone="info",
                    title=f"{game.title} is finding their level",
                    detail=f"It stepped up {plural(len(moves) - eased, 'time')} and eased off "
                    f"{plural(eased, 'time')} after misses. They're working around level {game.level}.",
                    game_id=game.game_id,
                )
            )
    return found


def trouble_insight(spots: Sequence[TroubleSpot]) -> list[Insight]:
    if not spots or spots[0].misses < TROUBLE_HEADLINE_MISSES:
        return []
    top = spots[0]
    return [
        Insight(
            tone="attention",
            title=f"Keeps missing {top.prompt}",
            detail=f"Missed {top.misses} of {top.attempts} times in {top.game_title}. The answer is {top.answer}.",
            game_id=top.game_id,
        )
    ]


def habit_insights(totals: PeriodTotals, previous: PeriodTotals, games: Sequence[GameStat], days: int) -> list[Insight]:
    found: list[Insight] = []
    if totals.active_days >= STEADY_MIN_DAYS and totals.active_days / days >= STEADY_DAYS_SHARE:
        found.append(
            Insight(
                tone="celebrate",
                title=f"Played {totals.active_days} of the last {days} days",
                detail="Short, regular practice is what builds fluency.",
            )
        )
    if previous.minutes >= TIME_CHANGE_MIN_MINUTES:
        change = (totals.minutes - previous.minutes) / previous.minutes
        if abs(change) >= TIME_CHANGE_SHARE:
            direction = "more" if change > 0 else "less"
            found.append(
                Insight(
                    tone="info",
                    title=f"Playing {direction} than before",
                    detail=f"{totals.minutes} minutes, compared with {previous.minutes} in the {days} days before.",
                )
            )
    total_minutes = sum(g.minutes for g in games)
    if games and total_minutes > 0 and len(games) > 1 and games[0].minutes / total_minutes >= FAVORITE_SHARE:
        share = round(100 * games[0].minutes / total_minutes)
        found.append(
            Insight(
                tone="info",
                title=f"{games[0].title} is the favorite",
                detail=f"{share}% of play time went to it.",
                game_id=games[0].game_id,
            )
        )
    return found


def insights_for(
    parts: ReportParts,
    *,
    totals: PeriodTotals,
    previous: PeriodTotals,
    games: Sequence[GameStat],
    skills: Sequence[SkillStat],
    spots: Sequence[TroubleSpot],
) -> list[Insight]:
    """Most important first: things to keep an eye on, then wins, then notes."""
    idle = idle_insight(parts, last_played_at(parts))
    found = [
        *([idle] if idle is not None else []),
        *trouble_insight(spots),
        *skill_insights(skills),
        *level_insights(games, parts),
        *habit_insights(totals, previous, games, len(parts.current.days())),
    ]
    found.sort(key=lambda i: TONE_ORDER[i.tone])
    return found[:MAX_INSIGHTS]


def build_report(
    kid: Kid, history: KidHistory, games: Mapping[str, GameInfo], *, now: datetime, days: int, local_time: LocalTime
) -> KidReport:
    parts = report_parts(kid, history, games, now=now, days=days, local_time=local_time)
    totals = totals_for(parts.current, parts.answers, parts.stretches, parts.local_actions)
    previous = totals_for(parts.previous, parts.answers, parts.stretches, parts.local_actions)
    game_list = game_stats(parts.current, parts.answers, parts.stretches, history, games, local_time)
    skills = skill_stats(parts.current, parts.previous, parts.answers)
    spots = trouble_spots(parts.current, parts.answers, games)
    days_played = played_days(parts)
    return KidReport(
        profile_id=kid.profile_id,
        name=kid.name,
        avatar=kid.avatar,
        age=parts.today.year - kid.birth_year,
        range_days=days,
        today=parts.today,
        totals=totals,
        previous=previous,
        day_streak=day_streak(days_played, parts.today),
        longest_streak=longest_streak(days_played),
        last_played_at=last_played_at(parts),
        daily=daily_points(parts.current, parts.answers, parts.stretches),
        when=hour_cells(parts.current, parts.stretches),
        games=game_list,
        skills=skills,
        fact_cells=fact_cells(parts.current, parts.answers),
        trouble_spots=spots,
        weekly=weekly_points(parts.today, parts.answers, parts.stretches),
        insights=insights_for(parts, totals=totals, previous=previous, games=game_list, skills=skills, spots=spots),
        badges=sorted(history.badges, key=lambda b: b.awarded_at, reverse=True)[:MAX_BADGES],
    )


def kid_summary(report: KidReport) -> KidSummary:
    """The overview card, from a `SUMMARY_DAYS` report."""
    return KidSummary(
        profile_id=report.profile_id,
        name=report.name,
        avatar=report.avatar,
        age=report.age,
        last_played_at=report.last_played_at,
        minutes_7d=report.totals.minutes,
        active_days_7d=report.totals.active_days,
        problems_7d=report.totals.problems,
        first_try_pct_7d=report.totals.first_try_pct,
        day_streak=report.day_streak,
        daily_minutes_7d=[d.minutes for d in report.daily],
        attention_count=sum(1 for i in report.insights if i.tone == "attention"),
        headline=report.insights[0] if report.insights else None,
    )
