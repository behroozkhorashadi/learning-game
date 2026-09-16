import { describe, it, expect } from 'vitest'
import { isPuzzleSolvable, solvePuzzle } from './pathfinderSolver'
import { isOrthogonallyAdjacent } from './pathfinderRules'
import type { DotPuzzle, GridPosition } from './pathfinderTypes'

function rectangle(rows: number, columns: number): GridPosition[] {
  const dots: GridPosition[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) dots.push({ row, col })
  }
  return dots
}

describe('solvePuzzle', () => {
  it('solves a single-dot board trivially', () => {
    const puzzle: DotPuzzle = { id: 'one', difficulty: 'easy', rows: 1, columns: 1, dots: [{ row: 0, col: 0 }] }
    const result = solvePuzzle(puzzle)
    expect(result.solved).toBe(true)
    expect(result.path).toEqual([{ row: 0, col: 0 }])
  })

  it('finds a full path on a plain rectangular grid', () => {
    const puzzle: DotPuzzle = { id: 'rect', difficulty: 'easy', rows: 3, columns: 3, dots: rectangle(3, 3) }
    const result = solvePuzzle(puzzle)
    expect(result.solved).toBe(true)
    expect(result.path).toHaveLength(9)
  })

  it('every returned path visits each dot exactly once via legal moves', () => {
    const puzzle: DotPuzzle = { id: 'rect-2x4', difficulty: 'easy', rows: 2, columns: 4, dots: rectangle(2, 4) }
    const result = solvePuzzle(puzzle)
    expect(result.solved).toBe(true)
    const path = result.path!
    expect(path).toHaveLength(puzzle.dots.length)

    const seen = new Set(path.map((p) => `${p.row},${p.col}`))
    expect(seen.size).toBe(path.length) // no repeats

    for (let i = 1; i < path.length; i++) {
      expect(isOrthogonallyAdjacent(path[i - 1], path[i])).toBe(true)
    }
  })

  it('reports unsolvable for two dots that are not connected at all', () => {
    const puzzle: DotPuzzle = {
      id: 'disconnected',
      difficulty: 'easy',
      rows: 1,
      columns: 3,
      dots: [
        { row: 0, col: 0 },
        { row: 0, col: 2 }, // gap at col 1 — not orthogonally adjacent to col 0
      ],
    }
    const result = solvePuzzle(puzzle)
    expect(result.solved).toBe(false)
    expect(result.path).toBeNull()
  })

  it('reports unsolvable for a board no single path can cover (a plus with a stray dot)', () => {
    // A 3x3 ring (center removed) plus one dot dangling off a single corner
    // by only a diagonal — unreachable, so it can never be included, so no
    // path can cover every dot.
    const ring = rectangle(3, 3).filter((p) => !(p.row === 1 && p.col === 1))
    const puzzle: DotPuzzle = {
      id: 'unreachable-extra',
      difficulty: 'easy',
      rows: 5,
      columns: 5,
      dots: [...ring, { row: 4, col: 4 }],
    }
    expect(isPuzzleSolvable(puzzle)).toBe(false)
  })

  it('honors a forced starting dot', () => {
    const puzzle: DotPuzzle = { id: 'rect-2x2', difficulty: 'easy', rows: 2, columns: 2, dots: rectangle(2, 2) }
    const result = solvePuzzle(puzzle, { startAt: { row: 1, col: 1 } })
    expect(result.solved).toBe(true)
    expect(result.path![0]).toEqual({ row: 1, col: 1 })
  })

  it('respects a small node budget instead of hanging', () => {
    const puzzle: DotPuzzle = { id: 'rect-4x4', difficulty: 'hard', rows: 4, columns: 4, dots: rectangle(4, 4) }
    const result = solvePuzzle(puzzle, { maxNodes: 3 })
    expect(result.nodesExplored).toBeLessThanOrEqual(4)
  })
})
