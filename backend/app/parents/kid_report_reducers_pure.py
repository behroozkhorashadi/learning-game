"""The kid progress report, derived from history: what they practiced, how it went, how
long they played and when, which problems keep tripping them up, and how all of that is
moving over time. History in, `KidReport` out; the clock reading and the local-time
conversion arrive as arguments.

Vocabulary used throughout:

- an *answer* is one attempt at one problem;
- *first try* means right with no wrong tap or shot first (a game's `hints_used`), the
  fairest single measure of "knows it" across the games;
- *active minutes* are the time between consecutive actions, leaving out any break over
  `ACTIVE_GAP`, so a game left open on the couch doesn't count.
"""

import re
from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from itertools import pairwise
from types import MappingProxyType

from pydantic import BaseModel, ValidationError

from app.parents.parents_schemas_pure import (
    Area,
    DayPoint,
    FactCell,
    GameInfo,
    GameStat,
    HistoryAttempt,
    HourCell,
    Kid,
    KidHistory,
    LevelPoint,
    PeriodTotals,
    SkillStat,
    SkillStatus,
    TroubleSpot,
    WeekPoint,
)

LocalTime = Callable[[datetime], datetime]

ACTIVE_GAP = timedelta(minutes=5)
SITTING_GAP = timedelta(minutes=10)
WEEKS_OF_PROGRESS = 12
# A skill needs this many answers in a period before it's judged at all.
MIN_SKILL_ANSWERS = 8
STRONG_FIRST_TRY_PCT = 90
STRONG_MIN_ANSWERS = 15
NEEDS_WORK_FIRST_TRY_PCT = 70
MAX_TROUBLE_SPOTS = 8
MAX_WRONG_ANSWERS = 3
MAX_BADGES = 6
# Missed this many times (or every time it came up) makes a trouble spot.
TROUBLE_MISSES = 2

AREA_BY_SKILL_ID: Mapping[str, Area] = MappingProxyType(
    {
        "arithmetic_fluency": "math",
        "phonics": "reading",
        "spatial_reasoning": "puzzles",
        "creative_writing": "writing",
    }
)
OPERATION_SKILLS: Mapping[str, tuple[str, str]] = MappingProxyType(
    {
        "+": ("addition", "Addition"),
        "-": ("subtraction", "Subtraction"),
        "×": ("multiplication", "Multiplication"),
        "÷": ("division", "Division"),
    }
)
# How the operators read in a prompt (a real minus sign, not a hyphen).
OPERATOR_GLYPHS: Mapping[str, str] = MappingProxyType({"+": "+", "-": "\u2212", "×": "×", "÷": "÷"})
PATHFINDER_GAME_ID = "pathfinder_no_way_back"
_TILE_SUFFIX = re.compile(r"-\d+$")


# --- Reading one answer ---


@dataclass(frozen=True)
class Problem:
    """What was asked, as a parent reads it."""

    key: str
    prompt: str
    answer: str
    # (operator, left, right) for an arithmetic fact.
    fact: tuple[str, int, int] | None


@dataclass(frozen=True)
class Answer:
    attempt: HistoryAttempt
    local: datetime
    skill: str
    skill_label: str
    area: Area
    problem: Problem | None
    first_try: bool
    wrong_answer: str | None

    @property
    def day(self) -> date:
        return self.local.date()


def area_of(game: GameInfo | None) -> Area:
    for skill_id in game.skill_ids if game is not None else ():
        area = AREA_BY_SKILL_ID.get(skill_id)
        if area is not None:
            return area
    return "other"


class _ShownItem(BaseModel):
    """An `item_shown` event payload: the item, plus how it was paced."""

    item_id: str
    payload: dict[str, object] = {}


class _ArithmeticItem(BaseModel):
    left: int
    operator: str
    right: int
    answer: int
    missing: str = "answer"


class _WordItem(BaseModel):
    target_word: str
    correct_syllables: list[str] = []


class _Placed(BaseModel):
    """The attempt details the tile games record: the tiles the kid placed."""

    assembled: list[str | None] = []
    placement: list[str | None] = []


def _parsed[M: BaseModel](model: type[M], payload: Mapping[str, object]) -> M | None:
    try:
        return model.model_validate(payload)
    except ValidationError:
        return None


def shown_items(payloads: Iterable[Mapping[str, object]]) -> dict[str, dict[str, object]]:
    """Item id -> the item's own payload, from the `item_shown` event payloads."""
    items: dict[str, dict[str, object]] = {}
    for payload in payloads:
        shown = _parsed(_ShownItem, payload)
        if shown is not None:
            items[shown.item_id] = shown.payload
    return items


def arithmetic_problem(payload: Mapping[str, object]) -> Problem | None:
    """`left op right = answer` with the `missing` part shown as "?"."""
    item = _parsed(_ArithmeticItem, payload)
    if item is None or item.operator not in OPERATION_SKILLS:
        return None
    parts = {
        "left": str(item.left),
        "operator": OPERATOR_GLYPHS[item.operator],
        "right": str(item.right),
        "answer": str(item.answer),
    }
    missing = item.missing if item.missing in parts else "answer"
    shown = {**parts, missing: "?"}
    return Problem(
        key=f"{item.left}{item.operator}{item.right}={item.answer}|{missing}",
        prompt=f"{shown['left']} {shown['operator']} {shown['right']} = {shown['answer']}",
        answer=parts[missing],
        fact=(item.operator, item.left, item.right),
    )


def word_problem(payload: Mapping[str, object]) -> Problem | None:
    item = _parsed(_WordItem, payload)
    if item is None:
        return None
    return Problem(
        key=f"word:{item.target_word}",
        prompt=item.target_word,
        answer="·".join(item.correct_syllables) or item.target_word,
        fact=None,
    )


def syllable_count(payload: Mapping[str, object]) -> int:
    item = _parsed(_WordItem, payload)
    return max(len(item.correct_syllables), 1) if item is not None else 1


def _tile_labels(placement: Sequence[str | None]) -> list[str]:
    """Tile ids are `<label>-<index>`; the label is what the kid saw. An empty slot is "_"."""
    return [_TILE_SUFFIX.sub("", tile) if tile is not None else "_" for tile in placement]


def wrong_answer_of(attempt: HistoryAttempt) -> str | None:
    """What the kid put instead, for the games that record it (built words, placed tiles)."""
    if attempt.correct is not False:
        return None
    placed = _parsed(_Placed, attempt.details)
    if placed is None:
        return None
    if placed.assembled:
        return "·".join(_tile_labels(placed.assembled))
    if placed.placement:
        return " ".join(_tile_labels(placed.placement))
    return None


def read_answer(
    attempt: HistoryAttempt,
    items: Mapping[str, Mapping[str, object]],
    games: Mapping[str, GameInfo],
    local_time: LocalTime,
) -> Answer:
    game = games.get(attempt.game_id)
    payload = items.get(attempt.item_id, {})
    problem = arithmetic_problem(payload) or word_problem(payload)
    if problem is not None and problem.fact is not None:
        skill, label = OPERATION_SKILLS[problem.fact[0]]
    elif problem is not None:
        count = syllable_count(payload)
        skill, label = f"words_{count}", f"{count}-syllable words"
    else:
        skill, label = attempt.game_id, game.title if game is not None else attempt.game_id
    return Answer(
        attempt=attempt,
        local=local_time(attempt.created_at),
        skill=skill,
        skill_label=label,
        area=area_of(game),
        problem=problem,
        first_try=attempt.correct is True and attempt.hints_used == 0,
        wrong_answer=wrong_answer_of(attempt),
    )


# --- Small statistics ---


def pct(part: int, whole: int) -> int | None:
    return None if whole == 0 else round(100 * part / whole)


def median(values: Sequence[int]) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return round((ordered[middle - 1] + ordered[middle]) / 2)


def graded(answers: Iterable[Answer]) -> list[Answer]:
    """Answers with a right/wrong (score-only writing attempts have none)."""
    return [a for a in answers if a.attempt.correct is not None]


def first_try_pct(answers: Sequence[Answer]) -> int | None:
    marked = graded(answers)
    return pct(sum(a.first_try for a in marked), len(marked))


def accuracy_pct(answers: Sequence[Answer]) -> int | None:
    marked = graded(answers)
    return pct(sum(a.attempt.correct is True for a in marked), len(marked))


def median_answer_ms(answers: Sequence[Answer]) -> int | None:
    return median([a.attempt.time_ms for a in answers if a.attempt.correct is True and a.attempt.time_ms > 0])


# --- Time ---


@dataclass(frozen=True)
class Stretch:
    """Active time between two consecutive actions, credited to the later one's game."""

    local_start: datetime
    minutes: float
    game_id: str


def active_stretches(actions: Sequence[tuple[datetime, str]], local_time: LocalTime) -> list[Stretch]:
    ordered = sorted(actions)
    return [
        Stretch(local_start=local_time(before), minutes=(after - before).total_seconds() / 60, game_id=game_id)
        for (before, _), (after, game_id) in pairwise(ordered)
        if after - before <= ACTIVE_GAP
    ]


def sittings(actions: Sequence[datetime]) -> list[tuple[datetime, datetime]]:
    """Runs of play with no break over `SITTING_GAP`: (first action, last action)."""
    runs: list[tuple[datetime, datetime]] = []
    for moment in sorted(actions):
        if runs and moment - runs[-1][1] <= SITTING_GAP:
            runs[-1] = (runs[-1][0], moment)
        else:
            runs.append((moment, moment))
    return runs


def day_streak(days: set[date], today: date) -> int:
    """Consecutive days played ending today (or yesterday: today isn't over yet)."""
    day = today if today in days else today - timedelta(days=1)
    streak = 0
    while day in days:
        streak += 1
        day -= timedelta(days=1)
    return streak


def longest_streak(days: set[date]) -> int:
    best = 0
    for day in days:
        if day - timedelta(days=1) in days:
            continue
        length = 1
        while day + timedelta(days=length) in days:
            length += 1
        best = max(best, length)
    return best


# --- A period ---


@dataclass(frozen=True)
class Period:
    first: date
    last: date

    def holds(self, day: date) -> bool:
        return self.first <= day <= self.last

    def days(self) -> list[date]:
        return [self.first + timedelta(days=n) for n in range((self.last - self.first).days + 1)]


def periods(today: date, days: int) -> tuple[Period, Period]:
    """The `days` ending today, and the same number just before."""
    current = Period(first=today - timedelta(days=days - 1), last=today)
    previous = Period(first=current.first - timedelta(days=days), last=current.first - timedelta(days=1))
    return current, previous


def totals_for(
    period: Period, answers: Sequence[Answer], stretches: Sequence[Stretch], local_actions: Sequence[datetime]
) -> PeriodTotals:
    inside = [a for a in answers if period.holds(a.day)]
    minutes = sum(s.minutes for s in stretches if period.holds(s.local_start.date()))
    moments = [m for m in local_actions if period.holds(m.date())]
    runs = sittings(moments)
    sitting_minutes = [(end - start).total_seconds() / 60 for start, end in runs]
    marked = graded(inside)
    return PeriodTotals(
        minutes=round(minutes),
        active_days=len({m.date() for m in moments}),
        sittings=len(runs),
        problems=len(marked),
        correct=sum(a.attempt.correct is True for a in marked),
        accuracy_pct=accuracy_pct(inside),
        first_try_pct=first_try_pct(inside),
        avg_sitting_minutes=round(sum(sitting_minutes) / len(runs)) if runs else None,
        median_answer_ms=median_answer_ms(inside),
    )


def daily_points(period: Period, answers: Sequence[Answer], stretches: Sequence[Stretch]) -> list[DayPoint]:
    per_game: defaultdict[date, defaultdict[str, float]] = defaultdict(lambda: defaultdict(float))
    for stretch in stretches:
        per_game[stretch.local_start.date()][stretch.game_id] += stretch.minutes
    by_day: dict[date, list[Answer]] = {}
    for answer in graded(answers):
        by_day.setdefault(answer.day, []).append(answer)
    points: list[DayPoint] = []
    for day in period.days():
        games = per_game.get(day, defaultdict[str, float](float))
        day_answers = by_day.get(day, [])
        points.append(
            DayPoint(
                day=day,
                minutes=round(sum(games.values())),
                problems=len(day_answers),
                correct=sum(a.attempt.correct is True for a in day_answers),
                game_minutes={game: round(m) for game, m in sorted(games.items(), key=lambda g: -g[1]) if round(m) > 0},
            )
        )
    return points


def hour_cells(period: Period, stretches: Sequence[Stretch]) -> list[HourCell]:
    slots: defaultdict[tuple[int, int], float] = defaultdict(float)
    for stretch in stretches:
        if period.holds(stretch.local_start.date()):
            slots[(stretch.local_start.weekday(), stretch.local_start.hour)] += stretch.minutes
    return [
        HourCell(weekday=weekday, hour=hour, minutes=round(minutes))
        for (weekday, hour), minutes in sorted(slots.items())
        if round(minutes) > 0
    ]


# --- Games ---


def level_history(
    game_id: str,
    changes: Sequence[tuple[datetime, int, int]],
    period: Period,
    answers: Sequence[Answer],
    local_time: LocalTime,
) -> tuple[list[LevelPoint], int | None, int]:
    """(points, current level, levels moved this period). `changes` are (when, before,
    after), oldest first. Without any change, the level is the one the last answer was
    played at."""
    in_period = [c for c in changes if period.holds(local_time(c[0]).date())]
    before_period = [c for c in changes if local_time(c[0]).date() < period.first]
    game_answers = [a for a in answers if a.attempt.game_id == game_id]
    current = changes[-1][2] if changes else (game_answers[-1].attempt.level if game_answers else None)
    if current is None:
        return [], None, 0
    if in_period:
        start = in_period[0][1]
    elif before_period:
        start = before_period[-1][2]
    else:
        start = current
    first_answer = next((a for a in game_answers if period.holds(a.day)), None)
    origin = in_period[0][0] if in_period else (first_answer.attempt.created_at if first_answer else None)
    points = [LevelPoint(at=origin, level=start)] if origin is not None else []
    if in_period and first_answer is not None and first_answer.attempt.created_at < in_period[0][0]:
        points = [LevelPoint(at=first_answer.attempt.created_at, level=start)]
    points += [LevelPoint(at=at, level=after) for at, _, after in in_period]
    return points, current, current - start


def game_stats(
    period: Period,
    answers: Sequence[Answer],
    stretches: Sequence[Stretch],
    history: KidHistory,
    games: Mapping[str, GameInfo],
    local_time: LocalTime,
) -> list[GameStat]:
    minutes: defaultdict[str, float] = defaultdict(float)
    for stretch in stretches:
        if period.holds(stretch.local_start.date()):
            minutes[stretch.game_id] += stretch.minutes
    inside = [a for a in answers if period.holds(a.day)]
    actions = [*history.actions, *((at, PATHFINDER_GAME_ID) for at in history.pathfinder_completions)]
    played = {game_id for at, game_id in actions if period.holds(local_time(at).date())} | {
        a.attempt.game_id for a in inside
    }
    changes: dict[str, list[tuple[datetime, int, int]]] = {}
    for change in history.level_changes:
        changes.setdefault(change.game_id, []).append((change.at, change.before, change.after))
    ratings: dict[str, list[int]] = {}
    for game_id, value in history.ratings:
        ratings.setdefault(game_id, []).append(value)
    last_played: dict[str, datetime] = {}
    for moment, game_id in actions:
        last_played[game_id] = max(moment, last_played.get(game_id, moment))

    stats: list[GameStat] = []
    for game_id in played:
        info = games.get(game_id)
        game_answers = [a for a in inside if a.attempt.game_id == game_id]
        adaptive = info is not None and info.max_level > 1
        points, level, gained = (
            level_history(game_id, changes.get(game_id, []), period, answers, local_time) if adaptive else ([], None, 0)
        )
        game_ratings = ratings.get(game_id, [])
        stats.append(
            GameStat(
                game_id=game_id,
                title=info.title if info is not None else game_id,
                icon=info.icon if info is not None else "🎮",
                area=area_of(info),
                minutes=round(minutes[game_id]),
                problems=len(graded(game_answers)),
                accuracy_pct=accuracy_pct(game_answers),
                first_try_pct=first_try_pct(game_answers),
                median_answer_ms=median_answer_ms(game_answers),
                level=level,
                max_level=info.max_level if adaptive and info is not None else None,
                levels_gained=gained,
                level_history=points,
                last_played_at=last_played.get(game_id),
                rating=round(sum(game_ratings) / len(game_ratings), 1) if game_ratings else None,
                note=game_note(game_id, period, history, local_time),
            )
        )
    return sorted(stats, key=lambda s: (-s.minutes, -s.problems, s.title))


def game_note(game_id: str, period: Period, history: KidHistory, local_time: LocalTime) -> str | None:
    if game_id != PATHFINDER_GAME_ID:
        return None
    solved = sum(1 for at in history.pathfinder_completions if period.holds(local_time(at).date()))
    total = len(history.pathfinder_completions)
    return f"{solved} puzzle{'s' if solved != 1 else ''} solved ({total} all time)"


# --- Skills ---


def skill_status(first_try: int | None, answers: int) -> SkillStatus:
    if first_try is None or answers < MIN_SKILL_ANSWERS:
        return "new"
    if first_try < NEEDS_WORK_FIRST_TRY_PCT:
        return "needs_work"
    if first_try >= STRONG_FIRST_TRY_PCT and answers >= STRONG_MIN_ANSWERS:
        return "strong"
    return "steady"


def skill_stats(current: Period, previous: Period, answers: Sequence[Answer]) -> list[SkillStat]:
    by_skill: dict[str, list[Answer]] = {}
    for answer in graded(answers):
        by_skill.setdefault(answer.skill, []).append(answer)
    stats: list[SkillStat] = []
    for skill, skill_answers in by_skill.items():
        now = [a for a in skill_answers if current.holds(a.day)]
        if not now:
            continue
        before = [a for a in skill_answers if previous.holds(a.day)]
        first_try = first_try_pct(now)
        stats.append(
            SkillStat(
                key=skill,
                label=now[0].skill_label,
                area=now[0].area,
                problems=len(now),
                accuracy_pct=accuracy_pct(now),
                first_try_pct=first_try,
                median_answer_ms=median_answer_ms(now),
                previous_first_try_pct=first_try_pct(before) if len(before) >= MIN_SKILL_ANSWERS else None,
                previous_median_answer_ms=median_answer_ms(before) if len(before) >= MIN_SKILL_ANSWERS else None,
                status=skill_status(first_try, len(now)),
            )
        )
    order = {"math": 0, "reading": 1, "puzzles": 2, "writing": 3, "other": 4}
    return sorted(stats, key=lambda s: (order[s.area], -s.problems))


def fact_cells(period: Period, answers: Sequence[Answer]) -> list[FactCell]:
    cells: dict[tuple[str, int, int], list[Answer]] = {}
    for answer in graded(answers):
        if answer.problem is not None and answer.problem.fact is not None and period.holds(answer.day):
            cells.setdefault(answer.problem.fact, []).append(answer)
    return [
        FactCell(operator=op, left=left, right=right, attempts=len(group), first_try=sum(a.first_try for a in group))
        for (op, left, right), group in sorted(cells.items())
    ]


def trouble_spots(period: Period, answers: Sequence[Answer], games: Mapping[str, GameInfo]) -> list[TroubleSpot]:
    """Problems missed at least twice (or every time they came up) this period: the
    ones worth sitting down and practicing together."""
    groups: dict[tuple[str, str], list[Answer]] = {}
    for answer in graded(answers):
        if answer.problem is not None and period.holds(answer.day):
            groups.setdefault((answer.attempt.game_id, answer.problem.key), []).append(answer)
    spots: list[TroubleSpot] = []
    for (game_id, _), group in groups.items():
        misses = [a for a in group if not a.first_try]
        if len(misses) < TROUBLE_MISSES:
            continue
        problem = group[0].problem
        if problem is None:
            continue
        info = games.get(game_id)
        wrong = [a.wrong_answer for a in reversed(misses) if a.wrong_answer is not None]
        spots.append(
            TroubleSpot(
                game_id=game_id,
                game_title=info.title if info is not None else game_id,
                skill=group[0].skill_label,
                prompt=problem.prompt,
                answer=problem.answer,
                attempts=len(group),
                misses=len(misses),
                last_seen_at=group[-1].attempt.created_at,
                wrong_answers=list(dict.fromkeys(wrong))[:MAX_WRONG_ANSWERS],
            )
        )
    spots.sort(key=lambda s: (-s.misses, -(s.misses / s.attempts), -s.last_seen_at.timestamp()))
    return spots[:MAX_TROUBLE_SPOTS]


# --- Progress over the weeks ---


def week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def weekly_points(today: date, answers: Sequence[Answer], stretches: Sequence[Stretch]) -> list[WeekPoint]:
    this_week = week_start(today)
    starts = [this_week - timedelta(weeks=n) for n in reversed(range(WEEKS_OF_PROGRESS))]
    by_week: dict[date, list[Answer]] = {}
    for answer in graded(answers):
        by_week.setdefault(week_start(answer.day), []).append(answer)
    minutes: defaultdict[date, float] = defaultdict(float)
    for stretch in stretches:
        minutes[week_start(stretch.local_start.date())] += stretch.minutes
    points: list[WeekPoint] = []
    for start in starts:
        week = by_week.get(start, [])
        math = [a for a in week if a.area == "math"]
        reading = [a for a in week if a.area == "reading"]
        points.append(
            WeekPoint(
                week_start=start,
                minutes=round(minutes[start]),
                problems=len(week),
                math_first_try_pct=first_try_pct(math),
                reading_first_try_pct=first_try_pct(reading),
                math_median_answer_ms=median_answer_ms(math),
            )
        )
    return points


# --- Putting it together ---


@dataclass(frozen=True)
class ReportParts:
    """Everything the report and its insights are built from."""

    kid: Kid
    today: date
    current: Period
    previous: Period
    answers: tuple[Answer, ...]
    stretches: tuple[Stretch, ...]
    local_actions: tuple[datetime, ...]
    history: KidHistory
    local_time: LocalTime


def report_parts(
    kid: Kid, history: KidHistory, games: Mapping[str, GameInfo], *, now: datetime, days: int, local_time: LocalTime
) -> ReportParts:
    today = local_time(now).date()
    current, previous = periods(today, days)
    items = shown_items(history.shown_items)
    answers = tuple(read_answer(a, items, games, local_time) for a in history.attempts)
    actions = (*history.actions, *((at, PATHFINDER_GAME_ID) for at in history.pathfinder_completions))
    return ReportParts(
        kid=kid,
        today=today,
        current=current,
        previous=previous,
        answers=answers,
        stretches=tuple(active_stretches(actions, local_time)),
        local_actions=tuple(local_time(at) for at, _ in actions),
        history=history,
        local_time=local_time,
    )


def played_days(parts: ReportParts) -> set[date]:
    return {m.date() for m in parts.local_actions}


def last_played_at(parts: ReportParts) -> datetime | None:
    moments = [at for at, _ in parts.history.actions] + list(parts.history.pathfinder_completions)
    return max(moments) if moments else None
