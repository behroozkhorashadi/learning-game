/**
 * Pathfinder: No Way Back — algorithmic difficulty assessment.
 *
 * Every curated level's `difficulty` used to be a hand-typed guess made
 * while authoring it. That doesn't work once players can build and publish
 * their own maps: there's no author judgment to fall back on, so the tier a
 * published map lands in has to come from measuring the board itself.
 *
 * First version of this engine weighted raw dot count heavily, on the
 * theory that bigger boards take longer to plan. That was wrong: a big,
 * mostly-open board with no real traps solves in essentially zero
 * backtracking (nodesExplored ~= dotCount, a straight, forgiving sweep) —
 * it's tedious, not hard. "The Colossus" (180 dots) scored as Legendary
 * under that formula despite being trivial to actually solve.
 *
 * The signal that actually tracks difficulty is *backtrack ratio*: how
 * many DFS nodes a search with no lookahead strategy needs, relative to
 * the dot count. `solvePuzzle(..., { neighborOrder: 'fixed' })` disables
 * the solver's Warnsdorff heuristic (which is itself a genuine planning
 * skill a casual player doesn't have) for exactly this measurement — a
 * board that's only easy for the *smart* solver but brutal for the naive
 * one is brutal for a person too. A ratio near 1 means no meaningful
 * backtracking was needed at all, regardless of size; a ratio in the
 * thousands means the naive search kept wandering into dead ends. Size
 * still counts for something (bigger is at least more tedious) but only as
 * a minor factor now, not the dominant one.
 *
 * Three signals combine into a 0-100 score, bucketed into the four tiers.
 * The bucket thresholds are calibrated against the curated levels in
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
  /** DFS nodes a Warnsdorff-guided solve needed — kept for visibility, not
   * used in scoring (see the file header on why it under-measures difficulty). */
  smartSearchCost: number
  /** DFS nodes a no-lookahead ("fixed" neighbor order) solve needed,
   * divided by dot count. The primary difficulty signal. */
  backtrackRatio: number
  /** True if the naive pass hit its node budget without confirming a path
   * — treated as "extremely hard" (maxed out) rather than measured exactly,
   * since we already know the board is solvable from the smart pass. */
  naiveSearchCapped: boolean
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

// Calibrated against the curated levels (pathfinderDifficulty.test.ts).
const SIZE_NORMALIZER = 150 // dot count that maxes out the (minor) size component
const BACKTRACK_RATIO_CEILING = 5_000 // ratio that maxes out the (dominant) backtrack component
const NAIVE_SEARCH_BUDGET = 300_000 // keeps a single assessment fast even for a pathological board
const WEIGHT_SIZE = 0.1
const WEIGHT_JUNCTION = 0.25
const WEIGHT_BACKTRACK = 0.65

const TIER_MAX_SCORE: { max: number; tier: Difficulty }[] = [
  { max: 30, tier: 'easy' },
  { max: 45, tier: 'medium' },
  { max: 65, tier: 'hard' },
  { max: Infinity, tier: 'legendary' },
]

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function computeMetrics(puzzle: DotPuzzle, solveResult: SolveResult, naiveSearchBudget: number): DifficultyMetrics {
  const neighborMap = buildNeighborMap(puzzle)
  const junctionCount = puzzle.dots.filter((d) => (neighborMap.get(coordKey(d)) ?? []).length >= 3).length
  const dotCount = puzzle.dots.length

  const naive = solvePuzzle(puzzle, { neighborOrder: 'fixed', maxNodes: naiveSearchBudget })
  const naiveSearchCapped = naive.limitReached
  const backtrackRatio = naiveSearchCapped ? Infinity : naive.nodesExplored / Math.max(1, dotCount)

  return {
    dotCount,
    junctionRatio: dotCount === 0 ? 0 : junctionCount / dotCount,
    smartSearchCost: solveResult.nodesExplored,
    backtrackRatio,
    naiveSearchCapped,
  }
}

function scoreOf(metrics: DifficultyMetrics): number {
  const sizeScore = clamp01(metrics.dotCount / SIZE_NORMALIZER)
  const junctionScore = clamp01(metrics.junctionRatio)
  const backtrackScore = metrics.naiveSearchCapped
    ? 1
    : clamp01(Math.log2(metrics.backtrackRatio + 1) / Math.log2(BACKTRACK_RATIO_CEILING + 1))
  return Math.round(100 * (WEIGHT_SIZE * sizeScore + WEIGHT_JUNCTION * junctionScore + WEIGHT_BACKTRACK * backtrackScore))
}

function tierForScore(score: number): Difficulty {
  return TIER_MAX_SCORE.find((t) => score <= t.max)!.tier
}

/**
 * Assesses a board's difficulty. Accepts an already-computed `solveResult`
 * from a normal (Warnsdorff) solve — the map builder already solves the
 * board to show the solution preview; this avoids solving it twice — and
 * always runs its own separate no-lookahead solve for the backtrack-ratio
 * measurement, since that's a different search than the one that found
 * the preview path.
 *
 * `naiveSearchBudget` defaults to a generous cap suitable for a one-off
 * interactive check; pass a much smaller one when calling this inside a
 * tight loop (`pathfinderGenerator.ts` evaluates hundreds of candidates
 * per run and needs each check to be cheap, not exact).
 */
export function assessDifficulty(
  puzzle: DotPuzzle,
  solveResult?: SolveResult,
  naiveSearchBudget: number = NAIVE_SEARCH_BUDGET,
): DifficultyAssessment {
  const result = solveResult ?? solvePuzzle(puzzle)
  if (!result.solved) {
    return { solvable: false, tier: null, score: null, metrics: computeMetrics(puzzle, result, naiveSearchBudget) }
  }
  const metrics = computeMetrics(puzzle, result, naiveSearchBudget)
  const score = scoreOf(metrics)
  return { solvable: true, tier: tierForScore(score), score, metrics }
}
