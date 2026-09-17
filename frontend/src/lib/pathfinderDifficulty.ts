/**
 * Pathfinder: No Way Back — algorithmic difficulty assessment.
 *
 * Every curated level's `difficulty` used to be a hand-typed guess made
 * while authoring it. That doesn't work once players can build and publish
 * their own maps: there's no author judgment to fall back on, so the tier a
 * published map lands in has to come from measuring the board itself.
 *
 * Three signals, all derived from things the solver/board graph already
 * expose for free:
 *  - size: raw dot count. Bigger boards take longer to plan out.
 *  - junction ratio: the fraction of dots with 3+ legal neighbors. A
 *    corridor (degree-2 dots throughout) has no real decisions to make; a
 *    board full of junctions has many places a wrong choice can strand an
 *    unvisited region, which is what actually makes planning hard (this is
 *    the same reasoning the curated Easy/Medium/Hard levels were designed
 *    around — see pathfinderLevels.ts's file header).
 *  - search cost: how many DFS nodes `solvePuzzle` needed to find a path,
 *    log-scaled since it can span orders of magnitude. More backtracking
 *    needed by an exhaustive search is a reasonable proxy for more dead
 *    ends a person would wander into by hand.
 *
 * These combine into a 0-100 score, bucketed into the four tiers. The
 * bucket thresholds are calibrated against the 15 curated levels in
 * pathfinderLevels.ts (see pathfinderDifficulty.test.ts's calibration
 * check) rather than picked arbitrarily.
 */

import { buildNeighborMap, coordKey } from './pathfinderRules'
import { solvePuzzle, type SolveResult } from './pathfinderSolver'
import type { Difficulty, DotPuzzle } from './pathfinderTypes'

export interface DifficultyMetrics {
  dotCount: number
  /** Fraction of dots with 3 or more legal neighbors. */
  junctionRatio: number
  /** DFS nodes the solver needed to find a path (or exhausted its budget
   * trying to). Not meaningful when `solvable` is false. */
  searchCost: number
}

export interface DifficultyAssessment {
  solvable: boolean
  /** Null when the board isn't solvable — a tier is meaningless for a
   * board that can't be played at all. */
  tier: Difficulty | null
  /** 0-100. Null alongside `tier` when not solvable. */
  score: number | null
  metrics: DifficultyMetrics
}

// Calibrated against the 15 curated levels (pathfinderDifficulty.test.ts).
const SIZE_NORMALIZER = 90 // dot count that maxes out the size component
const SEARCH_COST_CEILING = 300_000 // node count that maxes out the search component
const WEIGHT_SIZE = 0.45
const WEIGHT_JUNCTION = 0.25
const WEIGHT_SEARCH = 0.3

const TIER_MAX_SCORE: { max: number; tier: Difficulty }[] = [
  { max: 40, tier: 'easy' },
  { max: 50, tier: 'medium' },
  { max: 70, tier: 'hard' },
  { max: Infinity, tier: 'legendary' },
]

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function computeMetrics(puzzle: DotPuzzle, solveResult: SolveResult): DifficultyMetrics {
  const neighborMap = buildNeighborMap(puzzle)
  const junctionCount = puzzle.dots.filter((d) => (neighborMap.get(coordKey(d)) ?? []).length >= 3).length
  return {
    dotCount: puzzle.dots.length,
    junctionRatio: puzzle.dots.length === 0 ? 0 : junctionCount / puzzle.dots.length,
    searchCost: solveResult.nodesExplored,
  }
}

function scoreOf(metrics: DifficultyMetrics): number {
  const sizeScore = clamp01(metrics.dotCount / SIZE_NORMALIZER)
  const junctionScore = clamp01(metrics.junctionRatio)
  // log-scaled: the difference between 50 and 500 backtracking nodes matters
  // far more than the difference between 200,000 and 250,000 does.
  const searchScore = clamp01(Math.log2(metrics.searchCost + 1) / Math.log2(SEARCH_COST_CEILING))
  return Math.round(100 * (WEIGHT_SIZE * sizeScore + WEIGHT_JUNCTION * junctionScore + WEIGHT_SEARCH * searchScore))
}

function tierForScore(score: number): Difficulty {
  return TIER_MAX_SCORE.find((t) => score <= t.max)!.tier
}

/**
 * Assesses a board's difficulty. Accepts an already-computed `solveResult`
 * (the map builder already solves the board to show the solution preview;
 * this avoids solving it twice) — solves it itself otherwise.
 */
export function assessDifficulty(puzzle: DotPuzzle, solveResult?: SolveResult): DifficultyAssessment {
  const result = solveResult ?? solvePuzzle(puzzle)
  if (!result.solved) {
    return { solvable: false, tier: null, score: null, metrics: computeMetrics(puzzle, result) }
  }
  const metrics = computeMetrics(puzzle, result)
  const score = scoreOf(metrics)
  return { solvable: true, tier: tierForScore(score), score, metrics }
}
