import { describe, expect, it } from 'vitest'
import {
  accuracyText,
  bestSoFarText,
  dayFromIso,
  earnedWhenText,
  formatAverageRating,
  formatEarnedDate,
  formatLastSession,
  formatMinutes,
  formatProgress,
  heatLevel,
  isoDay,
  progressFraction,
  progressText,
  serverTime,
  shelfSections,
  streakCalendar,
  toGoText,
} from './badges_format.pure.lib.ts'
import { BADGES, FIXTURE_NOW, PATTERN_PRO, RECENT_DAYS, SHARPSHOOTER, WORD_WIZARD, ZOMBIE_SLAYER, badge } from './badges_fixtures.test.lib.ts'

describe('badges formatting', () => {
  it('says "Today at" only for a session on the same day as now', () => {
    expect(formatLastSession(null, new Date())).toBe('No sessions yet')
    const now = new Date(2026, 0, 5, 20, 0)
    const localNoon = (day: number): string => new Date(2026, 0, day, 12, 0).toISOString().replace('Z', '')
    expect(formatLastSession(localNoon(5), now)).toMatch(/^Today at /)
    expect(formatLastSession(localNoon(4), now)).not.toMatch(/^Today/)
  })

  it('reads zoneless server times as UTC', () => {
    expect(serverTime('2026-10-14T01:20:00').toISOString()).toBe('2026-10-14T01:20:00.000Z')
    expect(serverTime('2026-10-14T01:20:00Z').toISOString()).toBe('2026-10-14T01:20:00.000Z')
    expect(serverTime('2026-10-14T01:20:00+02:00').toISOString()).toBe('2026-10-13T23:20:00.000Z')
    expect(formatEarnedDate(new Date(2026, 9, 13, 18, 20).toISOString().replace('Z', ''))).toBe(new Date(2026, 9, 13).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
  })

  it('formats progress, rating, and minutes', () => {
    expect([formatProgress(null), formatProgress(10), formatProgress(-5)]).toEqual(['Not enough history yet', '↑ 10% improvement this month', '↓ 5% this month'])
    expect([formatAverageRating(null), formatAverageRating(4.25)]).toEqual(['No ratings yet', '4.3/5 stars'])
    expect([formatMinutes(0), formatMinutes(45), formatMinutes(60), formatMinutes(65)]).toEqual(['Under a minute', '45 min', '1 hr', '1 hr 5 min'])
  })
})

describe('badge progress', () => {
  it('says how far a locked badge is and how much is left', () => {
    expect(progressText(SHARPSHOOTER)).toBe('22 of 25 right in a row')
    expect(toGoText(SHARPSHOOTER)).toBe('3 more to go!')
    expect(progressFraction(SHARPSHOOTER)).toBeCloseTo(0.88)
    expect(progressFraction(WORD_WIZARD)).toBe(0)
  })

  it('treats an earned badge as full, and celebrates going past the goal', () => {
    expect(progressFraction(PATTERN_PRO)).toBe(1)
    expect(progressText(PATTERN_PRO)).toBe('10 of 10 right in a row')
    expect(toGoText(PATTERN_PRO)).toBeNull()
    expect(bestSoFarText(PATTERN_PRO)).toBe('Your best so far: 47 right in a row')
    expect(bestSoFarText(SHARPSHOOTER)).toBeNull()
  })

  it('has nothing to say for a badge that does not count', () => {
    const uncounted = badge({ progress: null, goal: null })
    expect([progressText(uncounted), toGoText(uncounted), progressFraction(uncounted)]).toEqual([null, null, 0])
  })

  it('says when and where a badge was earned', () => {
    expect(earnedWhenText(ZOMBIE_SLAYER)).toMatch(/^Earned Jan \d+ while playing Zombie Horde$/)
    expect(earnedWhenText(badge({ earned: true, awarded_at: null }))).toBe('Earned')
  })

  it('groups the shelf by category, in order, skipping empty ones', () => {
    const sections = shelfSections(BADGES)
    expect(sections.map((s) => s.category)).toEqual(['streaks', 'accuracy', 'games', 'creator', 'legend'])
    expect(sections[0]?.badges.map((b) => b.key)).toEqual(['streak-3', 'streak-7'])
  })
})

describe('the streak calendar', () => {
  it('reads and writes days on the local calendar', () => {
    expect(isoDay(FIXTURE_NOW)).toBe('2026-01-05')
    expect(isoDay(dayFromIso('2026-03-09'))).toBe('2026-03-09')
  })

  it('lays out six Monday-first weeks ending this week, marking the streak and today', () => {
    const weeks = streakCalendar(RECENT_DAYS, 3, FIXTURE_NOW)
    expect(weeks).toHaveLength(6)
    const lastWeek = weeks[5] ?? []
    expect(lastWeek.map((c) => c.day)).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11'])
    expect(lastWeek[0]).toMatchObject({ isToday: true, inStreak: true, isFuture: false })
    expect(lastWeek[1]).toMatchObject({ isFuture: true, played: null })
    const streak = weeks.flat().filter((c) => c.inStreak).map((c) => c.day)
    expect(streak).toEqual(['2026-01-03', '2026-01-04', '2026-01-05'])
    expect(weeks.flat().find((c) => c.day === '2026-01-01')?.played?.minutes).toBe(10)
  })

  it('keeps a streak that ended yesterday alive until today is over', () => {
    const notYetToday = RECENT_DAYS.filter((d) => d.day !== '2026-01-05')
    const streak = streakCalendar(notYetToday, 2, FIXTURE_NOW)
      .flat()
      .filter((c) => c.inStreak)
      .map((c) => c.day)
    expect(streak).toEqual(['2026-01-03', '2026-01-04'])
  })

  it('glows by minutes, and sums up each day', () => {
    expect([heatLevel(null), heatLevel(2), heatLevel(10), heatLevel(20), heatLevel(45)]).toEqual([0, 1, 2, 3, 4])
    expect(accuracyText({ day: '2026-01-05', minutes: 3, rounds: 80, correct: 71, games: [] })).toBe('71 of 80 right (89%)')
    expect(accuracyText({ day: '2026-01-05', minutes: 3, rounds: 0, correct: 0, games: [] })).toBe('No answers')
  })
})
