/**
 * Pathfinder: No Way Back — generator for genuinely hard boards.
 *
 * Hand-guessing "hard-looking" shapes doesn't reliably produce hard
 * boards: several curated levels that looked intricate (a big rectangle
 * with one obstacle, or a huge open field) turned out to have a
 * backtrack-ratio near 1 — solvable almost by just walking forward, no
 * planning required (see pathfinderDifficulty.ts's file header). This
 * generator instead searches for hard boards directly: simulated annealing
 * over which grid cells hold a dot, using `assessDifficulty`'s score as
 * the fitness function, so "hard" is measured the same way for generated
 * and hand-authored content alike.
 *
 * Not wired into the live game — this produces candidates to review and
 * freeze into `pathfinderLevels.ts` by hand, the same "hand-authored,
 * solver-verified" content model the rest of the level set uses. Nothing
 * stops a future live "generate me a puzzle" feature from calling this
 * directly; it's just not that today.
 */

import { assessDifficulty } from './pathfinderDifficulty'
import { findQuickUnsolvabilityProof, solvePuzzle } from './pathfinderSolver'
import type { DotPuzzle, GridPosition } from './pathfinderTypes'

export interface GenerateOptions {
  rows: number
  columns: number
  /** Mutation/acceptance steps to run. More steps explore more of the
   * search space at the cost of more time; a few hundred is usually enough
   * to find something meaningfully hard for boards up to ~10x10. */
  iterations?: number
  /** Reject any candidate whose dot count falls outside this range, so the
   * search stays within a size band instead of drifting toward a full or
   * near-empty grid (both of which tend to be easy). */
  minDots?: number
  maxDots?: number
  seed?: number
}

export interface GenerateResult {
  puzzle: DotPuzzle
  score: number
}

/** Deterministic PRNG (mulberry32) so a generation run can be reproduced
 * from its seed — useful for re-deriving a specific curated level later. */
function mulberry32(seed: number): () => number {
  let state = seed
  return function random() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fullRectangle(rows: number, columns: number): GridPosition[] {
  const dots: GridPosition[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) dots.push({ row, col })
  }
  return dots
}

function toPuzzle(rows: number, columns: number, dots: GridPosition[]): DotPuzzle {
  return { id: 'candidate', difficulty: 'easy', rows, columns, dots }
}

/** Every candidate mutation gets scored many times per run, so the naive
 * (no-lookahead) search that backs the difficulty score uses a much
 * tighter node budget here than a one-off interactive check would — a
 * search hitting this cap still reports as "very hard" (see
 * pathfinderDifficulty.ts), which is exactly the signal a hill-climb wants;
 * it just doesn't need to be precise about *how* hard past that point. */
const SEARCH_LOOP_NAIVE_BUDGET = 20_000
/** Same reasoning for the *smart* (Warnsdorff) solve that confirms
 * solvability: a genuinely solvable board almost always finds a path in a
 * few hundred nodes even under this cap (Warnsdorff is a good heuristic),
 * so this mostly costs accuracy only on the boards that don't matter —
 * ones with no solution at all, which otherwise cost a full search each to
 * rule out. A false "unsolvable" here just skips one candidate mutation;
 * it doesn't affect correctness of the final answer. */
const SEARCH_LOOP_SMART_BUDGET = 5_000

/** -1 for a candidate that's unsolvable or otherwise unusable — the search
 * never accepts those, so `current` always stays a valid, playable board. */
function fitnessOf(puzzle: DotPuzzle, minDots: number, maxDots: number): number {
  if (puzzle.dots.length < minDots || puzzle.dots.length > maxDots) return -1
  if (findQuickUnsolvabilityProof(puzzle)) return -1
  const solveResult = solvePuzzle(puzzle, { maxNodes: SEARCH_LOOP_SMART_BUDGET })
  if (!solveResult.solved) return -1
  return assessDifficulty(puzzle, solveResult, SEARCH_LOOP_NAIVE_BUDGET).score ?? -1
}

/** Toggles 1-2 random cells on/off. */
function mutate(rows: number, columns: number, dots: GridPosition[], rng: () => number): GridPosition[] {
  const keys = new Set(dots.map((d) => `${d.row},${d.col}`))
  const toggles = 1 + (rng() < 0.35 ? 1 : 0)
  for (let i = 0; i < toggles; i++) {
    const row = Math.floor(rng() * rows)
    const col = Math.floor(rng() * columns)
    const key = `${row},${col}`
    if (keys.has(key)) keys.delete(key)
    else keys.add(key)
  }
  return [...keys].map((key) => {
    const [row, col] = key.split(',').map(Number)
    return { row, col }
  })
}

/** Removes random cells from a full rectangle until the count falls at or
 * below `targetCount` — an in-bounds (if not necessarily solvable)
 * starting point for the search. Starting from the full rectangle itself
 * would only work when it's already within `[minDots, maxDots]`: every
 * single mutation step changes the dot count by at most ~2, so if the full
 * board is above `maxDots`, every step on the way down is *also* out of
 * bounds and gets rejected — the walk could never reach the target range
 * one small step at a time. */
function randomSubsetWithinBound(rows: number, columns: number, targetCount: number, rng: () => number): GridPosition[] {
  const dots = fullRectangle(rows, columns)
  while (dots.length > targetCount) {
    const index = Math.floor(rng() * dots.length)
    dots.splice(index, 1)
  }
  return dots
}

/**
 * Simulated annealing search for a hard board of the given size. Starts
 * from a random subset of a full rectangle sized within
 * `[minDots, maxDots]` (trivially easy at first) and repeatedly toggles
 * cells, keeping mutations that improve difficulty and occasionally
 * accepting worse ones (with decreasing probability as the run progresses)
 * to escape local optima. Always solvable — invalid/unsolvable mutations
 * are rejected outright, never accepted.
 */
export function generateHardBoard(options: GenerateOptions): GenerateResult {
  const { rows, columns } = options
  const iterations = options.iterations ?? 400
  const minDots = options.minDots ?? Math.floor(rows * columns * 0.4)
  const maxDots = options.maxDots ?? rows * columns
  const rng = mulberry32(options.seed ?? 1)

  let currentDots = randomSubsetWithinBound(rows, columns, maxDots, rng)
  let currentScore = fitnessOf(toPuzzle(rows, columns, currentDots), minDots, maxDots)
  let bestDots = currentDots
  let bestScore = currentScore

  for (let i = 0; i < iterations; i++) {
    const candidateDots = mutate(rows, columns, currentDots, rng)
    const score = fitnessOf(toPuzzle(rows, columns, candidateDots), minDots, maxDots)
    if (score < 0) continue

    const temperature = Math.max(0.01, 1 - i / iterations)
    const accept = score >= currentScore || rng() < Math.exp((score - currentScore) / (25 * temperature))
    if (!accept) continue

    currentDots = candidateDots
    currentScore = score
    if (score > bestScore) {
      bestDots = candidateDots
      bestScore = score
    }
  }

  // Final report uses the default (much larger) naive-search budget for an
  // accurate score — the tight budget above is only for keeping the
  // hundreds of in-loop evaluations fast, and can under-report how hard a
  // capped candidate actually is.
  const bestPuzzle = toPuzzle(rows, columns, bestDots)
  const finalAssessment = assessDifficulty(bestPuzzle, solvePuzzle(bestPuzzle))
  return { puzzle: bestPuzzle, score: finalAssessment.score ?? bestScore }
}
