import { describe, expect, it } from 'vitest'
import { ROUND_MS, type HordeStats } from './horde_engine.pure.lib.ts'
import { POINTS, formatTime, isNewBest, pointsBreakdown, roundPoints, type RoundResult } from './horde_scoring.pure.lib.ts'

const STATS: HordeStats = { shots: 20, correctHits: 12, wrongHits: 3, kills: 5, headshots: 3, legShots: 2, grenadesUsed: 0, shoves: 1, roundsUsed: 0, solved: 12, revealed: 0, livesLost: 1 }

/** Stopped right at the clock with 2 lives, no record to beat. */
const AT_CLOCK: RoundResult = { stats: STATS, livesAtClock: 2, lastedMs: ROUND_MS, clockMs: ROUND_MS, previousBestMs: 0 }

describe('horde scoring', () => {
  it('a good round that beats the clock is worth about 200 points', () => {
    const points = roundPoints(AT_CLOCK)
    expect(points).toBe(12 * POINTS.correctAnswer + 5 * POINTS.defeat + 3 * POINTS.headshot + POINTS.survived + 2 * POINTS.lifeLeft)
    expect(points).toBeGreaterThan(150)
    expect(points).toBeLessThan(400)
  })

  it('an overrun round keeps what it earned but no clock bonus', () => {
    const overrun = { ...AT_CLOCK, livesAtClock: null, lastedMs: 42_000 }
    expect(pointsBreakdown(overrun).map((line) => line.label)).toEqual(['Right answers', 'Zombies defeated', 'Headshots'])
  })

  it('overtime earns per second, and keeps the clock bonus even once the horde gets through', () => {
    const lines = pointsBreakdown({ ...AT_CLOCK, lastedMs: ROUND_MS + 30_900 })
    expect(lines).toContainEqual({ label: 'Held out 60 seconds', count: 1, points: POINTS.survived })
    expect(lines).toContainEqual({ label: 'Lives left at the clock', count: 2, points: 2 * POINTS.lifeLeft })
    expect(lines).toContainEqual({ label: 'Overtime seconds', count: 30, points: 30 * POINTS.overtimeSecond })
  })

  it('beating the personal best earns a bonus; setting the first one, or matching it, does not', () => {
    const longer = { ...AT_CLOCK, lastedMs: 95_000, previousBestMs: 90_000 }
    expect(isNewBest(longer)).toBe(true)
    expect(pointsBreakdown(longer)).toContainEqual({ label: 'New personal best', count: 1, points: POINTS.personalBest })
    expect(isNewBest({ ...longer, previousBestMs: 0 })).toBe(false)
    expect(isNewBest({ ...longer, previousBestMs: 95_000 })).toBe(false)
  })

  it('wrong answers never cost points, and an empty round is worth nothing', () => {
    expect(roundPoints({ ...AT_CLOCK, stats: { ...STATS, wrongHits: 99 } })).toBe(roundPoints(AT_CLOCK))
    expect(pointsBreakdown({ ...AT_CLOCK, stats: { ...STATS, solved: 0, kills: 0, headshots: 0 }, livesAtClock: null, lastedMs: 9000 })).toEqual([])
  })

  it('shows a round length as minutes and seconds', () => {
    expect([0, 45_900, 65_000, 600_000].map(formatTime)).toEqual(['0:00', '0:45', '1:05', '10:00'])
  })
})
