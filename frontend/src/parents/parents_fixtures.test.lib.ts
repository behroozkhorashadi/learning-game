import type { FactCell, KidReport, KidSummary, ParentRecord } from '@app/api/parents_schema.pure.lib.ts'

/**
 * Parent accounts and reports for tests and stories. The report is built
 * deterministically (no randomness): a seven-year-old who plays most days,
 * is solid at addition, shaky on division, and climbing in Zombie Horde.
 */

export const MOM: ParentRecord = { id: 1, name: 'Mom', created_at: '2026-10-01T12:00:00' }
export const DAD: ParentRecord = { id: 2, name: 'Dad', created_at: '2026-10-02T12:00:00' }
export const PARENTS: readonly ParentRecord[] = [MOM, DAD]

const TODAY = '2026-10-14'
/** The twelve Mondays ending this week. */
const WEEK_STARTS = ['2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'] as const

function isoDay(offset: number): string {
  // October 2026 has 31 days; fixtures stay inside Sep 1 – Oct 31.
  const day = 14 - offset
  return day >= 1 ? `2026-10-${String(day).padStart(2, '0')}` : `2026-09-${String(30 + day).padStart(2, '0')}`
}

function factCells(): readonly FactCell[] {
  const cells: FactCell[] = []
  for (let left = 1; left <= 10; left += 1) {
    for (let right = 1; right <= 10; right += 1) {
      if ((left * 7 + right * 3) % 4 === 0) continue
      const attempts = 1 + ((left + right) % 4)
      cells.push({ operator: '+', left, right, attempts, first_try: left + right === 13 ? 0 : attempts - ((left * right) % 5 === 0 ? 1 : 0) })
    }
  }
  for (let left = 2; left <= 9; left += 1) {
    for (let right = 2; right <= 6; right += 1) {
      const attempts = 1 + ((left * right) % 3)
      cells.push({ operator: '×', left, right, attempts, first_try: left >= 7 && right >= 6 ? 0 : Math.max(0, attempts - (left === 8 ? 1 : 0)) })
    }
  }
  cells.push({ operator: '÷', left: 35, right: 7, attempts: 3, first_try: 0 }, { operator: '÷', left: 12, right: 3, attempts: 2, first_try: 1 })
  return cells
}

/** A 30-day report for "Rami", with every section filled in. */
export function sampleReport(days = 30): KidReport {
  const daily = Array.from({ length: days }, (_, i) => {
    const offset = days - 1 - i
    const played = offset % 3 !== 1 && offset !== 9
    const horde = played ? 8 + ((offset * 7) % 23) : 0
    const outbreak = played && offset % 2 === 0 ? 5 + (offset % 9) : 0
    const syllables = played && offset % 5 === 0 ? 4 : 0
    const gameMinutes: Record<string, number> = {}
    if (horde > 0) gameMinutes['zombie_horde'] = horde
    if (outbreak > 0) gameMinutes['fact_fluency'] = outbreak
    if (syllables > 0) gameMinutes['syllable_builder'] = syllables
    const problems = played ? (horde + outbreak) * 3 + syllables : 0
    return { day: isoDay(offset), minutes: horde + outbreak + syllables, problems, correct: Math.round(problems * 0.8), game_minutes: gameMinutes }
  })
  return {
    profile_id: 2,
    name: 'Rami',
    avatar: 'fox',
    age: 7,
    range_days: days,
    today: TODAY,
    totals: { minutes: 412, active_days: 19, sittings: 31, problems: 1180, correct: 958, accuracy_pct: 81, first_try_pct: 77, avg_sitting_minutes: 13, median_answer_ms: 4300 },
    previous: { minutes: 280, active_days: 14, sittings: 20, problems: 760, correct: 570, accuracy_pct: 75, first_try_pct: 70, avg_sitting_minutes: 14, median_answer_ms: 5200 },
    day_streak: 4,
    longest_streak: 6,
    last_played_at: '2026-10-14T03:12:48',
    daily,
    when: [
      { weekday: 0, hour: 16, minutes: 22 },
      { weekday: 1, hour: 16, minutes: 47 },
      { weekday: 1, hour: 19, minutes: 12 },
      { weekday: 2, hour: 17, minutes: 30 },
      { weekday: 3, hour: 16, minutes: 18 },
      { weekday: 4, hour: 18, minutes: 9 },
      { weekday: 5, hour: 9, minutes: 55 },
      { weekday: 5, hour: 10, minutes: 40 },
      { weekday: 6, hour: 11, minutes: 26 },
      { weekday: 6, hour: 20, minutes: 6 },
    ],
    games: [
      {
        game_id: 'zombie_horde',
        title: 'Zombie Horde',
        icon: '🧟',
        area: 'math',
        minutes: 230,
        problems: 760,
        accuracy_pct: 82,
        first_try_pct: 79,
        median_answer_ms: 4100,
        level: 8,
        max_level: 12,
        levels_gained: 5,
        level_history: [
          { at: '2026-09-20T16:00:00', level: 3 },
          { at: '2026-09-24T16:10:00', level: 5 },
          { at: '2026-10-01T16:20:00', level: 4 },
          { at: '2026-10-06T17:00:00', level: 7 },
          { at: '2026-10-13T23:00:00', level: 8 },
        ],
        last_played_at: '2026-10-14T03:12:48',
        rating: 4.8,
        note: null,
      },
      {
        game_id: 'fact_fluency',
        title: 'Equation Outbreak',
        icon: '🧪',
        area: 'math',
        minutes: 140,
        problems: 390,
        accuracy_pct: 78,
        first_try_pct: 74,
        median_answer_ms: 4700,
        level: 7,
        max_level: 12,
        levels_gained: 2,
        level_history: [
          { at: '2026-09-18T16:00:00', level: 5 },
          { at: '2026-10-02T16:00:00', level: 6 },
          { at: '2026-10-10T16:00:00', level: 7 },
        ],
        last_played_at: '2026-10-12T17:30:00',
        rating: null,
        note: null,
      },
      {
        game_id: 'syllable_builder',
        title: 'Syllable Builder',
        icon: '🔤',
        area: 'reading',
        minutes: 30,
        problems: 30,
        accuracy_pct: 83,
        first_try_pct: 83,
        median_answer_ms: 10500,
        level: 3,
        max_level: 10,
        levels_gained: 1,
        level_history: [
          { at: '2026-09-20T16:00:00', level: 2 },
          { at: '2026-10-09T16:00:00', level: 3 },
        ],
        last_played_at: '2026-10-09T16:05:00',
        rating: null,
        note: null,
      },
      {
        game_id: 'pathfinder_no_way_back',
        title: 'Pathfinder: No Way Back',
        icon: '🔗',
        area: 'puzzles',
        minutes: 12,
        problems: 0,
        accuracy_pct: null,
        first_try_pct: null,
        median_answer_ms: null,
        level: null,
        max_level: null,
        levels_gained: 0,
        level_history: [],
        last_played_at: '2026-10-05T10:00:00',
        rating: null,
        note: '4 puzzles solved (11 all time)',
      },
    ],
    skills: [
      { key: 'addition', label: 'Addition', area: 'math', problems: 620, accuracy_pct: 90, first_try_pct: 88, median_answer_ms: 3600, previous_first_try_pct: 84, previous_median_answer_ms: 4400, status: 'steady' },
      { key: 'subtraction', label: 'Subtraction', area: 'math', problems: 310, accuracy_pct: 86, first_try_pct: 83, median_answer_ms: 4500, previous_first_try_pct: 80, previous_median_answer_ms: 5000, status: 'steady' },
      { key: 'multiplication', label: 'Multiplication', area: 'math', problems: 190, accuracy_pct: 70, first_try_pct: 64, median_answer_ms: 5600, previous_first_try_pct: 51, previous_median_answer_ms: 6900, status: 'needs_work' },
      { key: 'division', label: 'Division', area: 'math', problems: 30, accuracy_pct: 20, first_try_pct: 17, median_answer_ms: 7100, previous_first_try_pct: null, previous_median_answer_ms: null, status: 'needs_work' },
      { key: 'words_2', label: '2-syllable words', area: 'reading', problems: 24, accuracy_pct: 92, first_try_pct: 92, median_answer_ms: 9800, previous_first_try_pct: 80, previous_median_answer_ms: 12000, status: 'strong' },
      { key: 'words_3', label: '3-syllable words', area: 'reading', problems: 6, accuracy_pct: 50, first_try_pct: 50, median_answer_ms: 14000, previous_first_try_pct: null, previous_median_answer_ms: null, status: 'new' },
    ],
    fact_cells: factCells(),
    trouble_spots: [
      { game_id: 'zombie_horde', game_title: 'Zombie Horde', skill: 'Multiplication', prompt: '7 × 8 = ?', answer: '56', attempts: 6, misses: 4, last_seen_at: '2026-10-13T23:30:00', wrong_answers: [] },
      { game_id: 'fact_fluency', game_title: 'Equation Outbreak', skill: 'Division', prompt: '35 ÷ 7 = ?', answer: '5', attempts: 3, misses: 3, last_seen_at: '2026-10-12T17:20:00', wrong_answers: [] },
      { game_id: 'syllable_builder', game_title: 'Syllable Builder', skill: '3-syllable words', prompt: 'banana', answer: 'ba·na·na', attempts: 3, misses: 2, last_seen_at: '2026-10-09T16:04:00', wrong_answers: ['na·ba·na'] },
      { game_id: 'zombie_horde', game_title: 'Zombie Horde', skill: 'Addition', prompt: '7 + ? = 13', answer: '6', attempts: 5, misses: 2, last_seen_at: '2026-10-11T16:30:00', wrong_answers: [] },
    ],
    weekly: WEEK_STARTS.map((weekStart, i) => {
      return {
        week_start: weekStart,
        minutes: i < 4 ? 0 : 40 + i * 9,
        problems: i < 4 ? 0 : 90 + i * 25,
        math_first_try_pct: i < 4 ? null : 62 + i * 2,
        reading_first_try_pct: i < 6 || i === 9 ? null : 70 + i,
        math_median_answer_ms: i < 4 ? null : 6800 - i * 220,
      }
    }),
    insights: [
      { tone: 'attention', title: 'Keeps missing 7 × 8 = ?', detail: 'Missed 4 of 6 times in Zombie Horde. The answer is 56.', skill: null, game_id: 'zombie_horde' },
      { tone: 'attention', title: 'Division needs practice', detail: 'Right on the first try 17% of the time across 30 problems.', skill: 'division', game_id: null },
      { tone: 'celebrate', title: 'Improving at multiplication', detail: 'First-try accuracy went from 51% to 64%.', skill: 'multiplication', game_id: null },
      { tone: 'celebrate', title: 'Up 5 levels in Zombie Horde', detail: 'Now at level 8 of 12.', skill: null, game_id: 'zombie_horde' },
      { tone: 'celebrate', title: 'Played 19 of the last 30 days', detail: 'Short, regular practice is what builds fluency.', skill: null, game_id: null },
      { tone: 'info', title: 'Zombie Horde is the favorite', detail: '56% of play time went to it.', skill: null, game_id: 'zombie_horde' },
    ],
    badges: [
      { name: 'Hot Streak', tier: 'silver', awarded_at: '2026-10-13T23:10:00' },
      { name: 'Number Ninja', tier: 'gold', awarded_at: '2026-10-08T16:40:00' },
    ],
  }
}

/** A report for a kid with nothing in the period. */
export function emptyReport(): KidReport {
  const base = sampleReport(7)
  const zero = { minutes: 0, active_days: 0, sittings: 0, problems: 0, correct: 0, accuracy_pct: null, first_try_pct: null, avg_sitting_minutes: null, median_answer_ms: null }
  return {
    ...base,
    name: 'Nora',
    totals: zero,
    previous: zero,
    day_streak: 0,
    last_played_at: null,
    daily: base.daily.map((d) => ({ ...d, minutes: 0, problems: 0, correct: 0, game_minutes: {} })),
    when: [],
    games: [],
    skills: [],
    fact_cells: [],
    trouble_spots: [],
    weekly: base.weekly.map((w) => ({ ...w, minutes: 0, problems: 0, math_first_try_pct: null, reading_first_try_pct: null, math_median_answer_ms: null })),
    insights: [{ tone: 'info', title: "Hasn't played yet", detail: 'Nothing to show until the first game.', skill: null, game_id: null }],
    badges: [],
  }
}

export const RAMI_SUMMARY: KidSummary = {
  profile_id: 2,
  name: 'Rami',
  avatar: 'fox',
  age: 7,
  last_played_at: '2026-10-14T03:12:48',
  minutes_7d: 74,
  active_days_7d: 5,
  problems_7d: 316,
  first_try_pct_7d: 78,
  day_streak: 4,
  daily_minutes_7d: [4, 3, 0, 3, 0, 22, 43],
  attention_count: 2,
  headline: { tone: 'attention', title: 'Multiplication needs practice', detail: 'Right on the first try 52% of the time across 27 problems.', skill: 'multiplication', game_id: null },
}

export const LEILA_SUMMARY: KidSummary = {
  profile_id: 3,
  name: 'Leila',
  avatar: 'owl',
  age: 9,
  last_played_at: '2026-10-14T03:23:48',
  minutes_7d: 2,
  active_days_7d: 1,
  problems_7d: 22,
  first_try_pct_7d: 100,
  day_streak: 1,
  daily_minutes_7d: [0, 0, 0, 0, 0, 0, 2],
  attention_count: 0,
  headline: { tone: 'celebrate', title: 'Strong at addition', detail: '100% right on the first try across 15 problems.', skill: 'addition', game_id: null },
}

export const KID_SUMMARIES: readonly KidSummary[] = [RAMI_SUMMARY, LEILA_SUMMARY]
