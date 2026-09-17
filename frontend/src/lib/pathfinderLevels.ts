/**
 * Pathfinder: No Way Back — hand-authored sample levels.
 *
 * Procedural generation is deliberately out of scope for this first cut
 * (spec: prioritize a small, solver-validated hand-authored set; structure
 * things so generation can be layered on later). Every level here is
 * asserted solvable by `pathfinderSolver` in `pathfinderLevels.test.ts` — the
 * assertion is what makes these "validated", not the act of typing them out.
 *
 * Difficulty is aimed at 7-13 year olds, not younger — the original Easy/
 * Medium tier (small rectangles, ~6 dots) played as too trivial for that
 * range. The old "Hard" tier is now the baseline ("Easy"): a genuinely
 * mostly-open board is what actually makes a puzzle hard to plan (lots of
 * degree-3/4 junctions mean lots of ways to accidentally wall off an
 * unvisited region), not a long single-file corridor — a corridor's dots
 * mostly have degree 2, so there's rarely a real decision to make. Medium
 * and Hard scale that up: bigger open regions, more/larger holes, more
 * chances to trap a region if you don't plan ahead.
 */

import type { DotPuzzle, Difficulty, GridPosition } from './pathfinderTypes'

function rectangle(rows: number, columns: number): GridPosition[] {
  const dots: GridPosition[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) dots.push({ row, col })
  }
  return dots
}

function withoutCells(dots: GridPosition[], removed: GridPosition[]): GridPosition[] {
  const removedKeys = new Set(removed.map((p) => `${p.row},${p.col}`))
  return dots.filter((p) => !removedKeys.has(`${p.row},${p.col}`))
}

/** Builds dots from one contiguous column range [fromCol, toCol] per row. */
function fromRowRanges(ranges: [fromCol: number, toCol: number][]): GridPosition[] {
  const dots: GridPosition[] = []
  ranges.forEach(([fromCol, toCol], row) => {
    for (let col = fromCol; col <= toCol; col++) dots.push({ row, col })
  })
  return dots
}

function block(rowFrom: number, rowTo: number, colFrom: number, colTo: number): GridPosition[] {
  const cells: GridPosition[] = []
  for (let row = rowFrom; row <= rowTo; row++) {
    for (let col = colFrom; col <= colTo; col++) cells.push({ row, col })
  }
  return cells
}

const EASY_LEVELS: DotPuzzle[] = [
  {
    id: 'easy-staggered-diamond',
    name: 'Staggered Diamond',
    difficulty: 'easy',
    rows: 5,
    columns: 5,
    // Row lengths 3, 5, 5, 4, 3. Row 0 is offset to columns 0-2 rather than
    // centered under row 1: a grid graph is bipartite by (row+col) parity,
    // and a Hamiltonian path over an even number of dots needs an exact
    // 10/10 color split — centering every odd-length row the same way skews
    // that split and makes the board provably unsolvable regardless of how
    // the path is drawn.
    dots: fromRowRanges([
      [0, 2],
      [0, 4],
      [0, 4],
      [0, 3],
      [1, 3],
    ]),
  },
  {
    id: 'easy-notched-corridor',
    name: 'Notched Corridor',
    difficulty: 'easy',
    rows: 5,
    columns: 5,
    dots: withoutCells(rectangle(5, 5), [
      { row: 1, col: 3 },
      { row: 2, col: 1 },
      { row: 3, col: 3 },
    ]),
  },
  {
    id: 'easy-cross-frame',
    name: 'Cross Frame',
    difficulty: 'easy',
    rows: 6,
    columns: 6,
    // A 6x6 square with each 2x2 corner cut off — a thick plus/cross shape.
    dots: withoutCells(rectangle(6, 6), [
      ...block(0, 1, 0, 1),
      ...block(0, 1, 4, 5),
      ...block(4, 5, 0, 1),
      ...block(4, 5, 4, 5),
    ]),
  },
  {
    id: 'easy-scattered-frame',
    name: 'Scattered Frame',
    difficulty: 'easy',
    rows: 5,
    columns: 6,
    // A single interior notch rather than scattered single-cell holes near
    // the edges — scattered edge-adjacent holes kept accidentally cutting a
    // corner or edge dot down to one remaining neighbor ("a leaf"), and a
    // path only has two ends, so more than two leaf dots makes a board
    // provably unsolvable no matter how it's drawn.
    dots: withoutCells(rectangle(5, 6), block(1, 2, 2, 3)),
  },
  {
    id: 'easy-notched-tall',
    name: 'Notched Tall',
    difficulty: 'easy',
    rows: 6,
    columns: 4,
    dots: withoutCells(rectangle(6, 4), [
      { row: 1, col: 1 },
      { row: 2, col: 3 },
      { row: 3, col: 0 },
      { row: 4, col: 2 },
    ]),
  },
]

const MEDIUM_LEVELS: DotPuzzle[] = [
  {
    id: 'medium-open-field-with-holes',
    name: 'Open Field',
    difficulty: 'medium',
    rows: 6,
    columns: 6,
    // A mostly-open 6x6 field with six scattered single-cell holes: lots of
    // degree-3/4 junctions (real choices), and a hole beside a junction is
    // exactly the kind of thing that can strand a region if a player
    // doesn't look ahead.
    dots: withoutCells(rectangle(6, 6), [
      { row: 1, col: 1 },
      { row: 1, col: 4 },
      { row: 2, col: 3 },
      { row: 3, col: 1 },
      { row: 4, col: 4 },
      { row: 5, col: 2 },
    ]),
  },
  {
    id: 'medium-notched-rectangle',
    name: 'Notched Rectangle',
    difficulty: 'medium',
    rows: 7,
    columns: 5,
    dots: withoutCells(rectangle(7, 5), [
      { row: 0, col: 2 },
      { row: 1, col: 4 },
      { row: 2, col: 4 },
      { row: 4, col: 0 },
      { row: 5, col: 2 },
    ]),
  },
  {
    id: 'medium-wide-field',
    name: 'Wide Field',
    difficulty: 'medium',
    rows: 6,
    columns: 7,
    // A single interior notch — see easy-scattered-frame's note on why
    // scattered edge-adjacent holes are the wrong tool here.
    dots: withoutCells(rectangle(6, 7), block(2, 3, 1, 4)),
  },
  {
    id: 'medium-staggered-octagon',
    name: 'Staggered Octagon',
    difficulty: 'medium',
    rows: 8,
    columns: 6,
    // Row lengths 2,4,6,6,6,6,4,2 — every row has an even length, so each
    // one splits exactly half/half by bipartite color regardless of where
    // it's centered, sidestepping the parity juggling odd-length rows need.
    dots: fromRowRanges([
      [2, 3],
      [1, 4],
      [0, 5],
      [0, 5],
      [0, 5],
      [0, 5],
      [1, 4],
      [2, 3],
    ]),
  },
  {
    id: 'medium-wide-open-field',
    name: 'Wide Open Field',
    difficulty: 'medium',
    rows: 7,
    columns: 7,
    // A large, mostly-open 7x7 field with nine scattered holes — plenty of
    // junctions, plenty of ways to wall off a region without planning ahead.
    // Reclassified from Hard to Medium after the difficulty-assessment
    // engine landed: at only 42 dots with near-zero search cost, it scores
    // below the Medium/Hard boundary despite the original hand guess.
    dots: withoutCells(rectangle(7, 7), [
      { row: 1, col: 1 },
      { row: 1, col: 5 },
      { row: 2, col: 3 },
      { row: 4, col: 3 },
      { row: 5, col: 1 },
      { row: 5, col: 5 },
      { row: 6, col: 3 },
    ]),
  },
]

const HARD_LEVELS: DotPuzzle[] = [
  {
    id: 'hard-big-diamond',
    name: 'Big Diamond',
    difficulty: 'hard',
    rows: 7,
    columns: 7,
    // Row lengths 3,5,7,7,7,5,3 — a scaled-up version of the Easy diamond.
    // The two 3-wide tips are offset left (cols 1-3) rather than centered
    // (cols 2-4): all seven row lengths here are odd, so each row's start
    // parity swings the board's bipartite color balance by 1, and a
    // Hamiltonian path over an odd dot count needs that balance within 1 —
    // centering both tips the same way as the rest pushed it to 5.
    // Reclassified from Medium to Hard after the difficulty-assessment
    // engine landed: its search cost (~120k DFS nodes to find a path) is
    // far higher than every other level here, which the hand-picked label
    // didn't account for — see pathfinderDifficulty.ts's calibration note.
    dots: fromRowRanges([
      [1, 3],
      [1, 5],
      [0, 6],
      [0, 6],
      [0, 6],
      [1, 5],
      [1, 3],
    ]),
  },
  {
    id: 'hard-frame-with-block',
    name: 'The Block',
    difficulty: 'hard',
    rows: 8,
    columns: 6,
    // 8x6 with a 2x2 block carved from the interior plus a few edge
    // notches — a big open board with one substantial obstacle to route
    // around rather than many tiny ones.
    dots: withoutCells(rectangle(8, 6), [
      ...block(3, 4, 2, 3),
      { row: 1, col: 5 },
      { row: 6, col: 1 },
    ]),
  },
  {
    id: 'hard-giant-diamond',
    name: 'Giant Diamond',
    difficulty: 'hard',
    rows: 8,
    columns: 8,
    // Row lengths 4,6,8,8,8,8,6,4 — the largest, most open board in the set.
    dots: fromRowRanges([
      [2, 5],
      [1, 6],
      [0, 7],
      [0, 7],
      [0, 7],
      [0, 7],
      [1, 6],
      [2, 5],
    ]),
  },
  {
    id: 'hard-big-open-block',
    name: 'Big Open Block',
    difficulty: 'hard',
    rows: 8,
    columns: 7,
    // One substantial interior obstacle rather than many scattered
    // single-cell holes — see easy-scattered-frame's note.
    dots: withoutCells(rectangle(8, 7), block(3, 5, 2, 4)),
  },
  {
    id: 'hard-giant-block',
    name: 'Giant Block',
    difficulty: 'hard',
    rows: 9,
    columns: 6,
    // The largest board in the set. A single interior notch, same recipe as
    // Big Open Block — an earlier attempt at a symmetric tapered "octagon"
    // shape here (even-length rows, so bipartite-balanced by construction)
    // turned out to be far harder for the solver to search at this size
    // than the smaller Medium version of the same shape, even under a much
    // larger node budget, without ever confirming a solution — treated as
    // unreliable rather than shipped on faith.
    dots: withoutCells(rectangle(9, 6), block(3, 5, 1, 2)),
  },
]

const LEGENDARY_LEVELS: DotPuzzle[] = [
  {
    id: 'legendary-the-colossus',
    name: 'The Colossus',
    difficulty: 'legendary',
    rows: 14,
    columns: 14,
    // 180 dots — a 14x14 field (196) minus one 4x4 interior block. Far past
    // every Hard level's size, still almost entirely open (98% junctions),
    // which the difficulty engine scores well above the Hard ceiling (see
    // pathfinderDifficulty.test.ts's calibration check). A 4x4 block always
    // removes exactly 8 of each bipartite color, so it can't unbalance the
    // otherwise-guaranteed-even 14x14 rectangle regardless of where it sits.
    dots: withoutCells(rectangle(14, 14), block(5, 8, 5, 8)),
  },
]

export const LEVELS_BY_DIFFICULTY: Record<Difficulty, DotPuzzle[]> = {
  easy: EASY_LEVELS,
  medium: MEDIUM_LEVELS,
  hard: HARD_LEVELS,
  legendary: LEGENDARY_LEVELS,
}

/** Easy levels first, then Medium, then Hard, then Legendary — the fixed
 * order the level select screen displays and the unlock progression steps
 * through. Random picking (the old `pickLevel`) is gone: with only a
 * handful of levels per tier, drawing randomly repeated the same map far
 * too often; a sequential unlock chain fixes that and gives "some maps
 * need to be unlocked" a real mechanism. */
export const ALL_LEVELS: DotPuzzle[] = [...EASY_LEVELS, ...MEDIUM_LEVELS, ...HARD_LEVELS, ...LEGENDARY_LEVELS]
