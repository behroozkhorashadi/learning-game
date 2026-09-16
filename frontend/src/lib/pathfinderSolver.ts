/**
 * Pathfinder: No Way Back — puzzle solver / map validator.
 *
 * Deliberately separate from gameplay state and rendering (per spec) so it
 * can be reused to validate hand-authored or procedurally generated maps,
 * and later back a hint feature, without dragging in any React or DOM code.
 *
 * Depth-first search with backtracking over the orthogonal-adjacency graph.
 * Two prunes keep it fast enough for browser-sized boards:
 *  - Warnsdorff ordering: try the neighbor with the fewest onward unvisited
 *    options first, so dead ends are found (and abandoned) early.
 *  - Connectivity pruning: after a move, if the still-unvisited dots are no
 *    longer all reachable from where we are, the branch can never finish —
 *    stop exploring it immediately.
 * A node budget bounds worst-case work so a bad/unsolvable map can't hang
 * the caller; this is a validation/tooling function, not something the game
 * calls during play, so an expensive-but-bounded search here is fine.
 */

import { coordKey } from './pathfinderRules'
import type { DotPuzzle, GridPosition } from './pathfinderTypes'

export interface SolveOptions {
  /** Cap on DFS calls, across all start-dot attempts. */
  maxNodes?: number
  /** Restrict the search to paths starting at this dot. */
  startAt?: GridPosition
}

export interface SolveResult {
  solved: boolean
  path: GridPosition[] | null
  nodesExplored: number
  /** True if the node budget ran out before a definitive answer was found —
   * `solved: false` in that case means "not found within budget", not
   * "proven unsolvable". */
  limitReached: boolean
}

const DEFAULT_MAX_NODES = 200_000

function buildNeighborMap(puzzle: DotPuzzle): Map<string, string[]> {
  const dotSet = new Set(puzzle.dots.map(coordKey))
  const map = new Map<string, string[]>()
  for (const dot of puzzle.dots) {
    const candidates: GridPosition[] = [
      { row: dot.row - 1, col: dot.col },
      { row: dot.row + 1, col: dot.col },
      { row: dot.row, col: dot.col - 1 },
      { row: dot.row, col: dot.col + 1 },
    ]
    map.set(
      coordKey(dot),
      candidates.map(coordKey).filter((k) => dotSet.has(k)),
    )
  }
  return map
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
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES
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

    const ordered = unvisitedNeighbors
      .map((k) => ({ k, degree: (neighborMap.get(k) ?? []).filter((n) => !visited.has(n)).length }))
      .sort((a, b) => a.degree - b.degree)
      .map((e) => e.k)

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

  const starts = options.startAt ? [coordKey(options.startAt)] : puzzle.dots.map(coordKey)

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
      }
    }
    if (budget.limitReached) break
  }

  return { solved: false, path: null, nodesExplored: budget.nodes, limitReached: budget.limitReached }
}

export function isPuzzleSolvable(puzzle: DotPuzzle, options: SolveOptions = {}): boolean {
  return solvePuzzle(puzzle, options).solved
}
