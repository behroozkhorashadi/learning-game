/**
 * How hard a round is played, picked on the start screen: how fast the horde
 * walks, and how far its points go. Harder is slower to earn with, so the
 * armory stays worth saving for. Each difficulty keeps its own personal best
 * (the server's `best_survived_ms`, by difficulty).
 *
 * Medium is the game as tuned in horde_balance.pure.lib.test.ts.
 */

/** The server's difficulty ids (ArmoryRoundCreate.difficulty). */
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface DifficultyStats {
  readonly id: Difficulty
  readonly label: string
  /** What the start screen says about it. */
  readonly blurb: string
  /** A zombie's walk across the field takes this many times as long as at medium (more is slower). */
  readonly travelScale: number
  /** Every points line is multiplied by this. */
  readonly pointsScale: number
}

export const EASY: DifficultyStats = { id: 'easy', label: 'Easy', blurb: 'Slower zombies. Full points.', travelScale: 1.3, pointsScale: 1 }
export const MEDIUM: DifficultyStats = { id: 'medium', label: 'Medium', blurb: 'Regular zombies. Fewer points.', travelScale: 1, pointsScale: 0.6 }
export const HARD: DifficultyStats = { id: 'hard', label: 'Hard', blurb: 'Faster zombies. Points are scarce.', travelScale: 0.8, pointsScale: 0.3 }

export const DIFFICULTIES: readonly DifficultyStats[] = [EASY, MEDIUM, HARD]

export function difficultyById(id: Difficulty): DifficultyStats {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? MEDIUM
}
