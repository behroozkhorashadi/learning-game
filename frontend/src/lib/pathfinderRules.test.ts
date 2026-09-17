import { describe, it, expect } from 'vitest'
import {
  buildDotSet,
  checkMove,
  coordKey,
  hasLegalMoveFrom,
  isOrthogonallyAdjacent,
  isPuzzleComplete,
  isWithinSizeLimit,
  progressOf,
} from './pathfinderRules'
import type { DotPuzzle, GridPosition } from './pathfinderTypes'

// 3x3 grid missing the center dot, so (1,1) is a gap a move can't cross:
//   (0,0) (0,1) (0,2)
//   (1,0)   .   (1,2)
//   (2,0) (2,1) (2,2)
const PUZZLE: DotPuzzle = {
  id: 'test-ring',
  difficulty: 'easy',
  rows: 3,
  columns: 3,
  dots: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 1, col: 0 },
    { row: 1, col: 2 },
    { row: 2, col: 0 },
    { row: 2, col: 1 },
    { row: 2, col: 2 },
  ],
}

const dotSet = buildDotSet(PUZZLE)

function pos(row: number, col: number): GridPosition {
  return { row, col }
}

describe('isOrthogonallyAdjacent', () => {
  it('accepts the four cardinal neighbors', () => {
    expect(isOrthogonallyAdjacent(pos(1, 1), pos(0, 1))).toBe(true)
    expect(isOrthogonallyAdjacent(pos(1, 1), pos(2, 1))).toBe(true)
    expect(isOrthogonallyAdjacent(pos(1, 1), pos(1, 0))).toBe(true)
    expect(isOrthogonallyAdjacent(pos(1, 1), pos(1, 2))).toBe(true)
  })

  it('rejects diagonal neighbors', () => {
    expect(isOrthogonallyAdjacent(pos(1, 1), pos(0, 0))).toBe(false)
    expect(isOrthogonallyAdjacent(pos(1, 1), pos(2, 2))).toBe(false)
  })

  it('rejects a two-space jump', () => {
    expect(isOrthogonallyAdjacent(pos(0, 0), pos(0, 2))).toBe(false)
  })

  it('rejects the same position', () => {
    expect(isOrthogonallyAdjacent(pos(1, 1), pos(1, 1))).toBe(false)
  })
})

describe('checkMove', () => {
  it('accepts any dot as the starting move', () => {
    expect(checkMove(dotSet, [], pos(2, 2))).toEqual({ valid: true })
  })

  it('accepts an orthogonally adjacent, unvisited dot', () => {
    expect(checkMove(dotSet, [pos(0, 0)], pos(0, 1))).toEqual({ valid: true })
  })

  it('rejects a diagonal move', () => {
    expect(checkMove(dotSet, [pos(0, 0)], pos(1, 1))).toEqual({ valid: false, reason: 'no-dot' })
    expect(checkMove(dotSet, [pos(0, 1)], pos(1, 0))).toEqual({ valid: false, reason: 'not-adjacent' })
  })

  it('rejects jumping across the empty center gap', () => {
    // (1,0) -> (1,2) are two apart with a gap between them, not adjacent.
    expect(checkMove(dotSet, [pos(1, 0)], pos(1, 2))).toEqual({ valid: false, reason: 'not-adjacent' })
  })

  it('rejects clicking a nonadjacent dot', () => {
    expect(checkMove(dotSet, [pos(0, 0)], pos(2, 2))).toEqual({ valid: false, reason: 'not-adjacent' })
  })

  it('rejects clicking the current dot again', () => {
    expect(checkMove(dotSet, [pos(0, 0)], pos(0, 0))).toEqual({ valid: false, reason: 'same-dot' })
  })

  it('rejects returning to an earlier visited dot', () => {
    const path = [pos(0, 0), pos(0, 1), pos(0, 2)]
    expect(checkMove(dotSet, path, pos(0, 1))).toEqual({ valid: false, reason: 'already-visited' })
  })

  it('rejects a click on an empty grid position', () => {
    expect(checkMove(dotSet, [pos(0, 0)], pos(1, 1))).toEqual({ valid: false, reason: 'no-dot' })
  })

  it('rejects a click outside the board entirely', () => {
    expect(checkMove(dotSet, [pos(0, 0)], pos(9, 9))).toEqual({ valid: false, reason: 'no-dot' })
  })
})

describe('isPuzzleComplete / progressOf', () => {
  it('is not complete until every dot has been visited', () => {
    const path = [pos(0, 0), pos(0, 1)]
    expect(isPuzzleComplete(PUZZLE, path)).toBe(false)
    expect(progressOf(PUZZLE, path)).toEqual({ visited: 2, total: 8 })
  })

  it('is complete once the path length matches the dot count', () => {
    const fullPath = [pos(0, 0), pos(0, 1), pos(0, 2), pos(1, 2), pos(2, 2), pos(2, 1), pos(2, 0), pos(1, 0)]
    expect(isPuzzleComplete(PUZZLE, fullPath)).toBe(true)
  })
})

describe('hasLegalMoveFrom', () => {
  it('is true from the empty path when the board has dots', () => {
    expect(hasLegalMoveFrom(dotSet, [])).toBe(true)
  })

  it('is false at a dead end where every neighbor is visited or missing', () => {
    // Single-dot board: no neighbors exist at all once you've started.
    const single = buildDotSet({ id: 'single', difficulty: 'easy', rows: 1, columns: 1, dots: [pos(0, 0)] })
    expect(hasLegalMoveFrom(single, [pos(0, 0)])).toBe(false)
  })

  it('is true when at least one unvisited neighbor remains', () => {
    expect(hasLegalMoveFrom(dotSet, [pos(0, 0)])).toBe(true)
  })
})

describe('coordKey', () => {
  it('produces a stable, distinct key per position', () => {
    expect(coordKey(pos(1, 2))).toBe('1,2')
    expect(coordKey(pos(1, 2))).not.toBe(coordKey(pos(2, 1)))
  })
})

describe('isWithinSizeLimit', () => {
  it('allows a board at exactly the 50x50 ceiling', () => {
    expect(isWithinSizeLimit({ id: 'x', difficulty: 'easy', rows: 50, columns: 50, dots: [] })).toBe(true)
  })

  it('rejects a board one row over the ceiling', () => {
    expect(isWithinSizeLimit({ id: 'x', difficulty: 'easy', rows: 51, columns: 50, dots: [] })).toBe(false)
  })

  it('rejects a board one column over the ceiling', () => {
    expect(isWithinSizeLimit({ id: 'x', difficulty: 'easy', rows: 50, columns: 51, dots: [] })).toBe(false)
  })

  it('allows a small board', () => {
    expect(isWithinSizeLimit({ id: 'x', difficulty: 'easy', rows: 5, columns: 5, dots: [] })).toBe(true)
  })
})
