import { describe, it, expect } from 'vitest'
import { assessDifficulty } from './pathfinderDifficulty'
import { ALL_LEVELS } from './pathfinderLevels'
import { solvePuzzle } from './pathfinderSolver'
import type { DotPuzzle, GridPosition } from './pathfinderTypes'

function rectangle(rows: number, columns: number): GridPosition[] {
  const dots: GridPosition[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) dots.push({ row, col })
  }
  return dots
}

describe('assessDifficulty', () => {
  it('reports not solvable, with no tier or score, for an unsolvable board', () => {
    const puzzle: DotPuzzle = {
      id: 'disconnected',
      difficulty: 'easy',
      rows: 1,
      columns: 3,
      dots: [
        { row: 0, col: 0 },
        { row: 0, col: 2 },
      ],
    }
    const result = assessDifficulty(puzzle)
    expect(result.solvable).toBe(false)
    expect(result.tier).toBeNull()
    expect(result.score).toBeNull()
  })

  it('still reports structural metrics for an unsolvable board (dot count, junction ratio)', () => {
    const puzzle: DotPuzzle = { id: 'small-open', difficulty: 'easy', rows: 1, columns: 3, dots: [{ row: 0, col: 0 }, { row: 0, col: 2 }] }
    const result = assessDifficulty(puzzle)
    expect(result.metrics.dotCount).toBe(2)
  })

  it('a small, fully open rectangle assesses as easy', () => {
    const puzzle: DotPuzzle = { id: 'rect-3x2', difficulty: 'easy', rows: 3, columns: 2, dots: rectangle(3, 2) }
    const result = assessDifficulty(puzzle)
    expect(result.solvable).toBe(true)
    expect(result.tier).toBe('easy')
  })

  it('a much larger, fully open board assesses strictly harder than a small one', () => {
    const small = assessDifficulty({ id: 'small', difficulty: 'easy', rows: 3, columns: 3, dots: rectangle(3, 3) })
    const big = assessDifficulty({ id: 'big', difficulty: 'easy', rows: 12, columns: 12, dots: rectangle(12, 12) })
    expect(big.score!).toBeGreaterThan(small.score!)
  })

  it('reuses a pre-computed solve result instead of solving twice', () => {
    const puzzle: DotPuzzle = { id: 'rect-4x4', difficulty: 'easy', rows: 4, columns: 4, dots: rectangle(4, 4) }
    const solveResult = solvePuzzle(puzzle)
    const withoutReuse = assessDifficulty(puzzle)
    const withReuse = assessDifficulty(puzzle, solveResult)
    // Same board, same solver, same answer either way — reuse doesn't
    // change the outcome, only avoids a redundant solve.
    expect(withReuse.score).toBe(withoutReuse.score)
    expect(withReuse.metrics.searchCost).toBe(solveResult.nodesExplored)
  })

  it('a board at the 50x50 size ceiling does not exceed the legendary tier', () => {
    const puzzle: DotPuzzle = { id: 'max-size', difficulty: 'legendary', rows: 50, columns: 50, dots: rectangle(50, 50) }
    const result = assessDifficulty(puzzle)
    expect(result.solvable).toBe(true)
    expect(result.tier).toBe('legendary')
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

/**
 * The actual point of this engine: every curated level's hand-picked
 * `difficulty` label must agree with what the engine independently
 * computes. Two levels didn't when this was first built (medium-big-diamond
 * scored as hard; hard-wide-open-field scored as medium) — both were moved
 * to the tier the engine assessed rather than leaving the label wrong, and
 * the thresholds in pathfinderDifficulty.ts were calibrated against the
 * resulting set. If this test starts failing, it means either a level's
 * shape changed enough to shift its score, or the thresholds/weights were
 * tuned without rechecking against the curated set — reconcile one or the
 * other, the same way the original two mismatches were resolved.
 */
describe('curated levels agree with the difficulty engine', () => {
  it.each(ALL_LEVELS.map((puzzle) => [puzzle.id, puzzle] as const))('%s', (_id, puzzle) => {
    const assessment = assessDifficulty(puzzle)
    expect(assessment.solvable).toBe(true)
    expect(assessment.tier).toBe(puzzle.difficulty)
  })
})
