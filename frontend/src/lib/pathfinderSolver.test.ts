import { describe, it, expect } from 'vitest'
import { findQuickUnsolvabilityProof, isPuzzleSolvable, solvePuzzle } from './pathfinderSolver'
import { isOrthogonallyAdjacent } from './pathfinderRules'
import type { DotPuzzle, GridPosition } from './pathfinderTypes'

function rectangle(rows: number, columns: number): GridPosition[] {
  const dots: GridPosition[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) dots.push({ row, col })
  }
  return dots
}

function fromRowRanges(ranges: [fromCol: number, toCol: number][]): GridPosition[] {
  const dots: GridPosition[] = []
  ranges.forEach(([fromCol, toCol], row) => {
    for (let col = fromCol; col <= toCol; col++) dots.push({ row, col })
  })
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

  it('a search that genuinely exhausts its budget is not reported as proven unsolvable', () => {
    const puzzle: DotPuzzle = { id: 'rect-4x4', difficulty: 'hard', rows: 4, columns: 4, dots: rectangle(4, 4) }
    const result = solvePuzzle(puzzle, { maxNodes: 3 })
    expect(result.limitReached).toBe(true)
    expect(result.unsolvableReason).toBeNull()
  })

  it('solves a large (40x40, 1600-dot) open board quickly instead of hanging', () => {
    const puzzle: DotPuzzle = { id: 'huge', difficulty: 'legendary', rows: 40, columns: 40, dots: rectangle(40, 40) }
    const start = Date.now()
    const result = solvePuzzle(puzzle)
    expect(result.solved).toBe(true)
    expect(result.path).toHaveLength(1600)
    expect(Date.now() - start).toBeLessThan(5000)
  })
})

describe('findQuickUnsolvabilityProof', () => {
  it('proves an empty board unsolvable', () => {
    const puzzle: DotPuzzle = { id: 'empty', difficulty: 'easy', rows: 3, columns: 3, dots: [] }
    expect(findQuickUnsolvabilityProof(puzzle)).toBe('empty-board')
  })

  it('proves two disconnected regions unsolvable without running any search', () => {
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
    expect(findQuickUnsolvabilityProof(puzzle)).toBe('disconnected')
  })

  it('proves a board with more than two leaf dots unsolvable', () => {
    // A plus shape: center has degree 4, but each of the 4 arm tips is a
    // leaf (degree 1) — a path only has 2 ends, so 4 leaves is impossible.
    const puzzle: DotPuzzle = {
      id: 'plus',
      difficulty: 'easy',
      rows: 3,
      columns: 3,
      dots: [
        { row: 1, col: 1 },
        { row: 0, col: 1 },
        { row: 2, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 2 },
      ],
    }
    expect(findQuickUnsolvabilityProof(puzzle)).toBe('too-many-leaf-dots')
  })

  it('proves an unbalanced bipartite coloring unsolvable even when connected with no leaf-count issue', () => {
    // A staggered diamond (row lengths 3,5,5,4,3) with both 3-wide tips
    // centered under the full-width rows below/above them: connected,
    // every dot has degree >= 2 (no leaves at all), but centering both
    // odd-length tips the same way skews the bipartite color split to 9/11
    // instead of the 10/10 a 20-dot Hamiltonian path requires. This is the
    // exact shape a real curated level had before it was fixed by offsetting
    // one tip — see pathfinderLevels.ts's easy-staggered-diamond comment.
    const puzzle: DotPuzzle = {
      id: 'centered-diamond',
      difficulty: 'easy',
      rows: 5,
      columns: 5,
      dots: fromRowRanges([
        [1, 3],
        [0, 4],
        [0, 4],
        [0, 3],
        [1, 3],
      ]),
    }
    expect(findQuickUnsolvabilityProof(puzzle)).toBe('unbalanced-coloring')
  })

  it('returns null for a board that passes all three checks', () => {
    const puzzle: DotPuzzle = { id: 'rect-3x3', difficulty: 'easy', rows: 3, columns: 3, dots: rectangle(3, 3) }
    expect(findQuickUnsolvabilityProof(puzzle)).toBeNull()
  })
})
