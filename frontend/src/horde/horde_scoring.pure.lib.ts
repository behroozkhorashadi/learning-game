import type { HordeState, HordeStats } from './horde_engine.pure.lib.ts'

/**
 * A round's points, banked into the armory. Every right answer earns points,
 * a defeat and a headshot earn a bonus, and beating the clock earns a bonus
 * plus a little per life left at that moment. Overtime earns a little per
 * second survived, and lasting longer than the profile ever has (its personal
 * best) earns a bonus. A wrong answer never takes points away: losing a life
 * is its cost.
 *
 * Tuned so a good round is worth about 200 points, which puts every armory
 * item a handful of rounds away.
 */

export const POINTS = {
  correctAnswer: 10,
  defeat: 20,
  headshot: 5,
  survived: 50,
  lifeLeft: 10,
  overtimeSecond: 2,
  personalBest: 100,
} as const

/** What a finished round is scored on. */
export interface RoundResult {
  readonly stats: HordeStats
  /** The lives left when the clock was beaten; null when it wasn't. */
  readonly livesAtClock: number | null
  /** How long the round lasted, overtime included. */
  readonly lastedMs: number
  /** The clock to beat. */
  readonly clockMs: number
  /** The profile's longest round before this one; 0 before its first. */
  readonly previousBestMs: number
}

export interface PointsLine {
  readonly label: string
  readonly count: number
  readonly points: number
}

export function roundResult(state: HordeState, clockMs: number, previousBestMs: number): RoundResult {
  return { stats: state.stats, livesAtClock: state.livesAtClock, lastedMs: state.elapsedMs, clockMs, previousBestMs }
}

/** Lasted longer than any round before. A first round sets the record without beating one. */
export function isNewBest(result: RoundResult): boolean {
  return result.previousBestMs > 0 && result.lastedMs > result.previousBestMs
}

/** Whole seconds past the clock. */
export function overtimeSeconds(lastedMs: number, clockMs: number): number {
  return Math.max(Math.floor((lastedMs - clockMs) / 1000), 0)
}

/** The round's points, line by line, for the end screen. Lines worth nothing are left out. */
export function pointsBreakdown(result: RoundResult): readonly PointsLine[] {
  const { stats, livesAtClock } = result
  const beatClock = livesAtClock !== null
  const overtime = overtimeSeconds(result.lastedMs, result.clockMs)
  const best = isNewBest(result)
  const lines: readonly PointsLine[] = [
    { label: 'Right answers', count: stats.solved, points: stats.solved * POINTS.correctAnswer },
    { label: 'Zombies defeated', count: stats.kills, points: stats.kills * POINTS.defeat },
    { label: 'Headshots', count: stats.headshots, points: stats.headshots * POINTS.headshot },
    { label: `Held out ${String(Math.round(result.clockMs / 1000))} seconds`, count: beatClock ? 1 : 0, points: beatClock ? POINTS.survived : 0 },
    { label: 'Lives left at the clock', count: livesAtClock ?? 0, points: (livesAtClock ?? 0) * POINTS.lifeLeft },
    { label: 'Overtime seconds', count: overtime, points: overtime * POINTS.overtimeSecond },
    { label: 'New personal best', count: best ? 1 : 0, points: best ? POINTS.personalBest : 0 },
  ]
  return lines.filter((line) => line.points > 0)
}

export function roundPoints(result: RoundResult): number {
  return pointsBreakdown(result).reduce((sum, line) => sum + line.points, 0)
}

/** What the armor did for a round: throws reflected, zombies blocked, and heals, and the hearts that came to. */
export interface ArmorSaved {
  readonly reflected: number
  readonly blocked: number
  readonly healed: number
  /** A reflect saves a whole heart; a block saves half (it still costs half); a heal wins half back. */
  readonly hearts: number
}

export function armorSaved(stats: HordeStats): ArmorSaved {
  const healed = stats.gemsUsed.heal
  return { reflected: stats.reflects, blocked: stats.blocks, healed, hearts: stats.reflects + (stats.blocks + healed) / 2 }
}

/** Hearts as a kid reads them: "half a heart", "1 heart", "2½ hearts". */
export function heartsLabel(hearts: number): string {
  const whole = Math.floor(hearts)
  const half = hearts - whole >= 0.5
  if (whole === 0) return half ? 'half a heart' : '0 hearts'
  if (whole === 1 && !half) return '1 heart'
  return `${String(whole)}${half ? '½' : ''} hearts`
}

/** A round's length as the clock shows it: "0:45", "1:05". */
export function formatTime(ms: number): string {
  const seconds = Math.max(Math.floor(ms / 1000), 0)
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`
}
