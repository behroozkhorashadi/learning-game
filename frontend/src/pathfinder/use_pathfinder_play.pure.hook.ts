import { useEffect, useMemo, useRef, useState } from 'react'
import { buildDotSet, checkMove, hasLegalMoveFrom, isPuzzleComplete, progressOf, rejectionMessage } from './pathfinder_rules.pure.lib.ts'
import type { DotPuzzle, GridPosition, ScheduleTimeout } from './pathfinder_state.pure.lib.ts'

export const INVALID_FEEDBACK_MS = 1500

export interface PathfinderPlayState {
  readonly path: readonly GridPosition[]
  readonly completed: boolean
  readonly progress: { readonly visited: number; readonly total: number }
  readonly invalidReason: string | null
  readonly stuck: boolean
  readonly canUndo: boolean
  readonly canRestart: boolean
  readonly handleDotClick: (pos: GridPosition) => void
  readonly handleUndo: () => void
  readonly handleRestart: () => void
}

/** One attempt at one puzzle. Tagged with the puzzle id, so a different puzzle reads as a fresh attempt with no reset step. */
interface Attempt {
  readonly puzzleId: string
  readonly path: readonly GridPosition[]
  /** Path length before each move, so Undo takes back a whole multi-dot straight-line move in one press, the same way it was made. */
  readonly moveStarts: readonly number[]
  readonly invalidReason: string | null
}

const fresh = (puzzleId: string): Attempt => ({ puzzleId, path: [], moveStarts: [], invalidReason: null })

/**
 * Shared move-validation/undo/restart/completion state machine for playing
 * a single `DotPuzzle` — used by both the real game's play mode and the map
 * builder's play-test view, so the two can never drift apart on what counts
 * as a legal move. Switching to a different `puzzle.id` starts a fresh
 * attempt. An invalid move shows its reason for INVALID_FEEDBACK_MS, timed
 * by the injected `scheduleTimeout`.
 */
export function usePathfinderPlay(puzzle: DotPuzzle, scheduleTimeout: ScheduleTimeout, onComplete?: () => void): PathfinderPlayState {
  const [stored, setAttempt] = useState<Attempt>(() => fresh(puzzle.id))
  const attempt = stored.puzzleId === puzzle.id ? stored : fresh(puzzle.id)
  const cancelFeedback = useRef<(() => void) | null>(null)

  useEffect(
    () => () => {
      cancelFeedback.current?.()
    },
    [],
  )

  const dotSet = useMemo(() => buildDotSet(puzzle), [puzzle])
  const { path, moveStarts } = attempt
  const completed = isPuzzleComplete(puzzle, path)
  const canUndo = path.length > 0
  const stuck = !completed && path.length > 0 && !hasLegalMoveFrom(dotSet, path)

  function flashInvalid(message: string): void {
    setAttempt({ ...attempt, invalidReason: message })
    cancelFeedback.current?.()
    const forPuzzle = puzzle.id
    cancelFeedback.current = scheduleTimeout(() => {
      setAttempt((current) => (current.puzzleId === forPuzzle ? { ...current, invalidReason: null } : current))
    }, INVALID_FEEDBACK_MS)
  }

  function handleDotClick(pos: GridPosition): void {
    if (completed) return // no accidental additional moves once solved
    const result = checkMove(dotSet, path, pos)
    if (!result.valid) {
      flashInvalid(rejectionMessage(result.reason))
      return
    }
    const nextPath = [...path, ...result.steps]
    setAttempt({ ...attempt, path: nextPath, moveStarts: [...moveStarts, path.length] })
    if (isPuzzleComplete(puzzle, nextPath)) onComplete?.()
  }

  function handleUndo(): void {
    if (path.length === 0) return
    const start = moveStarts.at(-1) ?? path.length - 1
    setAttempt({ ...attempt, path: path.slice(0, start), moveStarts: moveStarts.slice(0, -1), invalidReason: null })
  }

  function handleRestart(): void {
    setAttempt(fresh(puzzle.id))
  }

  return {
    path,
    completed,
    progress: progressOf(puzzle, path),
    invalidReason: attempt.invalidReason,
    stuck,
    canUndo,
    canRestart: canUndo,
    handleDotClick,
    handleUndo,
    handleRestart,
  }
}
