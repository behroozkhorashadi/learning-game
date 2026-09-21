/**
 * Pathfinder: No Way Back — puzzle solver / map validator.
 *
 * Deliberately separate from gameplay state and rendering (per spec) so it
 * can be reused to validate hand-authored or procedurally generated maps,
 * back a hint feature, and now back a difficulty-assessment engine, without
 * dragging in any React or DOM code.
 *
 * Two layers:
 *  1. Fast, *provable* unsolvability checks (`findQuickUnsolvabilityProof`)
 *     — O(dots) necessary conditions any Hamiltonian path must satisfy.
 *     Boards that fail one of these are definitively unsolvable, no search
 *     needed. This matters once boards can be up to 50x50 (2,500 dots,
 *     player-built via the map builder): a naive/broken board that size
 *     must be rejected instantly, not by running a full backtracking search
 *     and hoping it terminates.
 *  2. Depth-first search with backtracking over whatever passes those
 *     checks, with Warnsdorff ordering (try the neighbor with the fewest
 *     onward options first, so dead ends are found and abandoned early) and
 *     connectivity pruning (abandon a branch the instant the remaining
 *     unvisited dots can no longer all be reached). A node budget still
 *     bounds worst-case work — the pre-checks catch most broken large
 *     boards, but they're necessary conditions, not sufficient ones, so a
 *     board can pass all of them and still have no solution.
 */

import { buildNeighborMap, coordKey } from './pathfinderRules'
import type { DotPuzzle, GridPosition } from './pathfinderTypes'

export interface SolveOptions {
  /** Cap on DFS calls, across all start-dot attempts. Defaults scale with
   * board size (see `defaultMaxNodes`) since a fixed budget that's generous
   * enough for a 50-dot board is far too small for a 2,000-dot one. */
  maxNodes?: number
  /** Restrict the search to paths starting at this dot. */
  startAt?: GridPosition
  /**
   * 'warnsdorff' (default): try the neighbor with the fewest onward options
   * first — a genuine planning heuristic, so node count under this mode
   * measures "how hard even with a good strategy", which is far too
   * forgiving to use as a difficulty signal (a huge but structurally
   * trivial board solves in a handful of nodes this way regardless of
   * size). 'fixed': try neighbors in plain grid order (up/down/left/right)
   * with no lookahead — closer to a person poking at the board without a
   * strategy, so how much backtracking *this* mode needs is what
   * `pathfinderDifficulty.ts` actually measures difficulty from.
   */
  neighborOrder?: 'warnsdorff' | 'fixed'
}

export type UnsolvabilityReason = 'empty-board' | 'disconnected' | 'too-many-leaf-dots' | 'unbalanced-coloring'

export interface SolveResult {
  solved: boolean
  path: GridPosition[] | null
  nodesExplored: number
  /** True if the node budget ran out before a definitive answer was found —
   * `solved: false` in that case means "not found within budget", not
   * "proven unsolvable". */
  limitReached: boolean
  /** Set when `solved: false` was determined instantly by
   * `findQuickUnsolvabilityProof` rather than by exhausting a search — a
   * mathematical certainty, not a search giving up. */
  unsolvableReason: UnsolvabilityReason | null
}

const BASE_MAX_NODES = 200_000
/** Node budget scales with board size — generous for small boards, capped
 * so a huge board can't hang the caller indefinitely. */
function defaultMaxNodes(dotCount: number): number {
  return Math.min(5_000_000, Math.max(BASE_MAX_NODES, dotCount * 2_000))
}

/**
 * O(dots) necessary conditions for a Hamiltonian path to exist. Any one of
 * these failing proves the board unsolvable outright:
 *  - it must be a single connected component (an isolated dot, or two
 *    separate regions, can never all be visited by one path);
 *  - at most 2 dots can have exactly one neighbor ("leaf" dots) — a path
 *    has exactly two ends, and a degree-1 dot has no choice but to be one,
 *    so a third leaf has nowhere to go;
 *  - the grid is bipartite by (row+col) parity, and a path alternates
 *    colors, so the two color counts can differ by at most 1.
 * These are necessary, not sufficient — a board can pass all three and
 * still have no solution, which is what the DFS below is for.
 */
export function findQuickUnsolvabilityProof(puzzle: DotPuzzle): UnsolvabilityReason | null {
  if (puzzle.dots.length === 0) return 'empty-board'
  const neighborMap = buildNeighborMap(puzzle)

  const start = coordKey(puzzle.dots[0])
  const seen = new Set([start])
  const stack = [start]
  while (stack.length > 0) {
    const key = stack.pop()!
    for (const neighbor of neighborMap.get(key) ?? []) {
      if (seen.has(neighbor)) continue
      seen.add(neighbor)
      stack.push(neighbor)
    }
  }
  if (seen.size !== puzzle.dots.length) return 'disconnected'

  const leafCount = puzzle.dots.filter((d) => (neighborMap.get(coordKey(d)) ?? []).length === 1).length
  if (leafCount > 2) return 'too-many-leaf-dots'

  const color0 = puzzle.dots.filter((d) => (d.row + d.col) % 2 === 0).length
  const color1 = puzzle.dots.length - color0
  if (Math.abs(color0 - color1) > 1) return 'unbalanced-coloring'

  return null
}

/** Necessary-condition prune: are all still-unvisited dots reachable from
 * `fromKey` without passing through a visited dot? If not, this branch can
 * never visit every dot, so it's safe to abandon. */
function unvisitedRegionIsConnected(
  fromKey: string,
  visited: Set<string>,
  totalUnvisited: number,
  neighborMap: Map<string, string[]>,
): boolean {
  if (totalUnvisited === 0) return true
  const seen = new Set<string>()
  const stack = [fromKey]
  while (stack.length > 0) {
    const key = stack.pop()!
    for (const neighbor of neighborMap.get(key) ?? []) {
      if (visited.has(neighbor) || seen.has(neighbor)) continue
      seen.add(neighbor)
      stack.push(neighbor)
    }
  }
  return seen.size === totalUnvisited
}

export function solvePuzzle(puzzle: DotPuzzle, options: SolveOptions = {}): SolveResult {
  const quickProof = findQuickUnsolvabilityProof(puzzle)
  if (quickProof) {
    return { solved: false, path: null, nodesExplored: 0, limitReached: false, unsolvableReason: quickProof }
  }

  const maxNodes = options.maxNodes ?? defaultMaxNodes(puzzle.dots.length)
  const useWarnsdorff = (options.neighborOrder ?? 'warnsdorff') === 'warnsdorff'
  const total = puzzle.dots.length
  const keyToPos = new Map(puzzle.dots.map((d) => [coordKey(d), d]))
  const neighborMap = buildNeighborMap(puzzle)

  const budget = { nodes: 0, limitReached: false }

  function dfs(currentKey: string, visited: Set<string>, path: string[]): boolean {
    budget.nodes += 1
    if (budget.nodes > maxNodes) {
      budget.limitReached = true
      return false
    }
    if (visited.size === total) return true

    const unvisitedNeighbors = (neighborMap.get(currentKey) ?? []).filter((k) => !visited.has(k))
    if (unvisitedNeighbors.length === 0) return false

    if (!unvisitedRegionIsConnected(currentKey, visited, total - visited.size, neighborMap)) return false

    const ordered = useWarnsdorff
      ? unvisitedNeighbors
          .map((k) => ({ k, degree: (neighborMap.get(k) ?? []).filter((n) => !visited.has(n)).length }))
          .sort((a, b) => a.degree - b.degree)
          .map((e) => e.k)
      : unvisitedNeighbors

    for (const next of ordered) {
      visited.add(next)
      path.push(next)
      if (dfs(next, visited, path)) return true
      path.pop()
      visited.delete(next)
      if (budget.limitReached) return false
    }
    return false
  }

  // Canonical (row, then column) order, not the order `puzzle.dots` happens
  // to be listed in — a board's difficulty must be a property of the graph,
  // not of how a caller happened to serialize its dot list. Without this,
  // re-sorting a puzzle's dots array for readability (as pathfinderLevels.ts
  // does) would silently change which start gets tried first and thus the
  // measured node count / difficulty score for the exact same board.
  const starts = options.startAt
    ? [coordKey(options.startAt)]
    : [...puzzle.dots].sort((a, b) => a.row - b.row || a.col - b.col).map(coordKey)

  for (const startKey of starts) {
    if (!keyToPos.has(startKey)) continue
    const visited = new Set([startKey])
    const path = [startKey]
    if (dfs(startKey, visited, path)) {
      return {
        solved: true,
        path: path.map((k) => keyToPos.get(k)!),
        nodesExplored: budget.nodes,
        limitReached: budget.limitReached,
        unsolvableReason: null,
      }
    }
    if (budget.limitReached) break
  }

  return { solved: false, path: null, nodesExplored: budget.nodes, limitReached: budget.limitReached, unsolvableReason: null }
}

export function isPuzzleSolvable(puzzle: DotPuzzle, options: SolveOptions = {}): boolean {
  return solvePuzzle(puzzle, options).solved
}
