import { describe, expect, it } from 'vitest'
import type { HordeStats } from './horde_engine.pure.lib.ts'
import { POINTS, pointsBreakdown, roundPoints } from './horde_scoring.pure.lib.ts'

const STATS: HordeStats = { shots: 20, correctHits: 12, wrongHits: 3, kills: 5, headshots: 3, legShots: 2, grenadesUsed: 0, shoves: 1, roundsUsed: 0, solved: 12, livesLost: 1 }

describe('horde scoring', () => {
  it('a good surviving round is worth about 200 points', () => {
    const points = roundPoints(STATS, 'survived', 2)
    expect(points).toBe(12 * POINTS.correctAnswer + 5 * POINTS.defeat + 3 * POINTS.headshot + POINTS.survived + 2 * POINTS.lifeLeft)
    expect(points).toBeGreaterThan(150)
    expect(points).toBeLessThan(400)
  })

  it('an overrun round keeps what it earned but no survival bonus', () => {
    expect(pointsBreakdown(STATS, 'overrun', 0).map((line) => line.label)).toEqual(['Right answers', 'Zombies defeated', 'Headshots'])
  })

  it('wrong answers never cost points, and an empty round is worth nothing', () => {
    expect(roundPoints({ ...STATS, wrongHits: 99 }, 'survived', 2)).toBe(roundPoints(STATS, 'survived', 2))
    expect(pointsBreakdown({ ...STATS, solved: 0, kills: 0, headshots: 0 }, 'overrun', 0)).toEqual([])
  })
})
