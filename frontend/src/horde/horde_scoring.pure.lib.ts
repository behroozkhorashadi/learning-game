import type { HordeOutcome, HordeStats } from './horde_engine.pure.lib.ts'

/**
 * A round's points, banked into the armory. Every right answer earns points,
 * a defeat and a headshot earn a bonus, and surviving the clock earns a bonus
 * plus a little per life left. A wrong answer never takes points away: losing
 * a life is its cost.
 *
 * Tuned so a good round is worth about 200 points, which puts every armory
 * item a handful of rounds away.
 */

export const POINTS = {
  correctAnswer: 5,
  defeat: 15,
  headshot: 5,
  survived: 50,
  lifeLeft: 10,
} as const

export interface PointsLine {
  readonly label: string
  readonly count: number
  readonly points: number
}

/** The round's points, line by line, for the end screen. Lines worth nothing are left out. */
export function pointsBreakdown(stats: HordeStats, outcome: HordeOutcome, livesLeft: number): readonly PointsLine[] {
  const survived = outcome === 'survived'
  const lines: readonly PointsLine[] = [
    { label: 'Right answers', count: stats.solved, points: stats.solved * POINTS.correctAnswer },
    { label: 'Zombies defeated', count: stats.kills, points: stats.kills * POINTS.defeat },
    { label: 'Headshots', count: stats.headshots, points: stats.headshots * POINTS.headshot },
    { label: 'Survived the horde', count: survived ? 1 : 0, points: survived ? POINTS.survived : 0 },
    { label: 'Lives left', count: survived ? livesLeft : 0, points: survived ? livesLeft * POINTS.lifeLeft : 0 },
  ]
  return lines.filter((line) => line.points > 0)
}

export function roundPoints(stats: HordeStats, outcome: HordeOutcome, livesLeft: number): number {
  return pointsBreakdown(stats, outcome, livesLeft).reduce((sum, line) => sum + line.points, 0)
}
