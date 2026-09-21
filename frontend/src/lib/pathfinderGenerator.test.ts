import { describe, it, expect } from 'vitest'
import { generateHardBoard } from './pathfinderGenerator'
import { assessDifficulty } from './pathfinderDifficulty'
import { isPuzzleSolvable } from './pathfinderSolver'

describe('generateHardBoard', () => {
  it('always returns a solvable board', () => {
    const result = generateHardBoard({ rows: 5, columns: 5, iterations: 100, seed: 1 })
    expect(isPuzzleSolvable(result.puzzle)).toBe(true)
  })

  it('respects the requested board dimensions', () => {
    const result = generateHardBoard({ rows: 5, columns: 6, iterations: 100, seed: 1 })
    expect(result.puzzle.rows).toBe(5)
    expect(result.puzzle.columns).toBe(6)
    for (const dot of result.puzzle.dots) {
      expect(dot.row).toBeGreaterThanOrEqual(0)
      expect(dot.row).toBeLessThan(5)
      expect(dot.col).toBeGreaterThanOrEqual(0)
      expect(dot.col).toBeLessThan(6)
    }
  })

  it('respects an explicit min/max dot count', () => {
    const result = generateHardBoard({ rows: 6, columns: 6, iterations: 150, seed: 2, minDots: 20, maxDots: 25 })
    expect(result.puzzle.dots.length).toBeGreaterThanOrEqual(20)
    expect(result.puzzle.dots.length).toBeLessThanOrEqual(25)
  })

  it('is deterministic given the same seed and parameters', () => {
    const a = generateHardBoard({ rows: 5, columns: 5, iterations: 100, seed: 7 })
    const b = generateHardBoard({ rows: 5, columns: 5, iterations: 100, seed: 7 })
    expect(a.puzzle.dots).toEqual(b.puzzle.dots)
    expect(a.score).toBe(b.score)
  })

  it('produces a board meaningfully harder than a trivial full rectangle of the same size', () => {
    const result = generateHardBoard({ rows: 6, columns: 6, iterations: 400, seed: 3 })
    const fullRectangleScore = assessDifficulty({
      id: 'baseline',
      difficulty: 'easy',
      rows: 6,
      columns: 6,
      dots: Array.from({ length: 6 }, (_, row) => Array.from({ length: 6 }, (_, col) => ({ row, col }))).flat(),
    }).score!
    expect(result.score).toBeGreaterThan(fullRectangleScore)
  })

  it('a longer search finds a board at least as hard as a shorter one on the same size/seed', () => {
    const short = generateHardBoard({ rows: 6, columns: 6, iterations: 50, seed: 5 })
    const long = generateHardBoard({ rows: 6, columns: 6, iterations: 400, seed: 5 })
    expect(long.score).toBeGreaterThanOrEqual(short.score)
  })

  it('completes quickly for a modest board size', () => {
    const start = Date.now()
    generateHardBoard({ rows: 7, columns: 7, iterations: 400, seed: 9 })
    expect(Date.now() - start).toBeLessThan(10_000)
  })
})
