/**
 * Pathfinder: No Way Back — movement rules and path-state derivation.
 *
 * The player's path is the single source of truth (an ordered array of
 * `GridPosition`); everything else (visited set, current dot, progress,
 * completion, whether any legal move remains) is derived from it here rather
 * than tracked as separate, possibly-conflicting state.
 */

import { MAX_BOARD_DIMENSION } from './pathfinderTypes'
import type { DotPuzzle, GridPosition } from './pathfinderTypes'

export function coordKey(pos: GridPosition): string {
  return `${pos.row},${pos.col}`
}

export function buildDotSet(puzzle: DotPuzzle): Set<string> {
  return new Set(puzzle.dots.map(coordKey))
}

/** Every dot's orthogonal neighbors that also hold a dot, keyed by
 * `coordKey`. Shared by the solver (unsolvability pre-checks, search) and
 * the difficulty engine (degree/junction metrics) so both agree on what
 * "adjacent" means without recomputing it separately. */
export function buildNeighborMap(puzzle: DotPuzzle): Map<string, string[]> {
  const dotSet = buildDotSet(puzzle)
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

export function isOrthogonallyAdjacent(a: GridPosition, b: GridPosition): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
}

export type MoveRejectionReason = 'no-dot' | 'same-dot' | 'already-visited' | 'not-adjacent'

export type MoveCheck = { valid: true } | { valid: false; reason: MoveRejectionReason }

const REJECTION_MESSAGES: Record<MoveRejectionReason, string> = {
  'no-dot': "There's no dot there.",
  'same-dot': "You're already there.",
  'already-visited': "That dot's already used — no going back.",
  'not-adjacent': 'Only straight to a neighbor — up, down, left, or right.',
}

export function rejectionMessage(reason: MoveRejectionReason): string {
  return REJECTION_MESSAGES[reason]
}

/**
 * The core move-validation rule (spec's four numbered conditions, plus the
 * two obvious edge cases of clicking the current dot or an earlier dot).
 * `dotSet` is `buildDotSet(puzzle)`, passed in so callers that check many
 * candidates don't rebuild it each time.
 */
export function checkMove(dotSet: Set<string>, path: readonly GridPosition[], candidate: GridPosition): MoveCheck {
  const candidateKey = coordKey(candidate)
  if (!dotSet.has(candidateKey)) return { valid: false, reason: 'no-dot' }

  if (path.length === 0) return { valid: true }

  const current = path[path.length - 1]
  if (coordKey(current) === candidateKey) return { valid: false, reason: 'same-dot' }

  const visited = visitedKeySet(path)
  if (visited.has(candidateKey)) return { valid: false, reason: 'already-visited' }

  if (!isOrthogonallyAdjacent(current, candidate)) return { valid: false, reason: 'not-adjacent' }

  return { valid: true }
}

export function visitedKeySet(path: readonly GridPosition[]): Set<string> {
  return new Set(path.map(coordKey))
}

export function isPuzzleComplete(puzzle: DotPuzzle, path: readonly GridPosition[]): boolean {
  return path.length === puzzle.dots.length
}

export function progressOf(puzzle: DotPuzzle, path: readonly GridPosition[]): { visited: number; total: number } {
  return { visited: path.length, total: puzzle.dots.length }
}

/**
 * True when at least one legal next move exists from the current dot. Used
 * to surface "no legal move — Undo or Restart" feedback; reaching a dead end
 * is explicitly not a loss condition (spec), just a state to communicate.
 */
export function hasLegalMoveFrom(dotSet: Set<string>, path: readonly GridPosition[]): boolean {
  if (path.length === 0) return dotSet.size > 0
  const current = path[path.length - 1]
  const visited = visitedKeySet(path)
  const neighbors: GridPosition[] = [
    { row: current.row - 1, col: current.col },
    { row: current.row + 1, col: current.col },
    { row: current.row, col: current.col - 1 },
    { row: current.row, col: current.col + 1 },
  ]
  return neighbors.some((n) => dotSet.has(coordKey(n)) && !visited.has(coordKey(n)))
}

/** A board's rows/columns must each stay within `MAX_BOARD_DIMENSION` —
 * enforced by the map builder's size inputs, and re-checked here so any
 * future path (e.g. a publish flow) can't bypass that by constructing a
 * `DotPuzzle` directly. */
export function isWithinSizeLimit(puzzle: DotPuzzle): boolean {
  return puzzle.rows <= MAX_BOARD_DIMENSION && puzzle.columns <= MAX_BOARD_DIMENSION
}
