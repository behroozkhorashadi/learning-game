import { useEffect, useMemo, useRef, useState } from 'react'
import { buildDotSet, checkMove, hasLegalMoveFrom, isPuzzleComplete, progressOf, rejectionMessage } from './pathfinderRules'
import type { DotPuzzle, GridPosition } from './pathfinderTypes'

const INVALID_FEEDBACK_MS = 1500

export interface PathfinderPlayState {
  path: GridPosition[]
  completed: boolean
  progress: { visited: number; total: number }
  invalidReason: string | null
  stuck: boolean
  canUndo: boolean
  canRestart: boolean
  handleDotClick: (pos: GridPosition) => void
  handleUndo: () => void
  handleRestart: () => void
}

/**
 * Shared move-validation/undo/restart/completion state machine for playing
 * a single `DotPuzzle` — used by both the real game (`Pathfinder.tsx`'s
 * play mode) and the map builder's "play your own creation" test view, so
 * the two can never drift apart on what counts as a legal move. Resets the
 * path automatically whenever `puzzle.id` changes, so callers loading a new
 * puzzle don't need to reset state themselves.
 */
export function usePathfinderPlay(puzzle: DotPuzzle, onComplete?: () => void): PathfinderPlayState {
  const [path, setPath] = useState<GridPosition[]>([])
  const [invalidReason, setInvalidReason] = useState<string | null>(null)
  const invalidTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setPath([])
    setInvalidReason(null)
  }, [puzzle.id])

  useEffect(() => {
    return () => {
      if (invalidTimer.current) clearTimeout(invalidTimer.current)
    }
  }, [])

  const dotSet = useMemo(() => buildDotSet(puzzle), [puzzle])
  const completed = isPuzzleComplete(puzzle, path)
  const progress = progressOf(puzzle, path)
  const canUndo = path.length > 0
  const canRestart = path.length > 0
  const stuck = !completed && path.length > 0 && !hasLegalMoveFrom(dotSet, path)

  function flashInvalid(message: string) {
    setInvalidReason(message)
    if (invalidTimer.current) clearTimeout(invalidTimer.current)
    invalidTimer.current = setTimeout(() => setInvalidReason(null), INVALID_FEEDBACK_MS)
  }

  function handleDotClick(pos: GridPosition) {
    if (completed) return // no accidental additional moves once solved
    const result = checkMove(dotSet, path, pos)
    if (!result.valid) {
      flashInvalid(rejectionMessage(result.reason))
      return
    }
    const nextPath = [...path, pos]
    setPath(nextPath)
    if (isPuzzleComplete(puzzle, nextPath)) onComplete?.()
  }

  function handleUndo() {
    if (path.length === 0) return
    setPath((prev) => prev.slice(0, -1))
    setInvalidReason(null)
  }

  function handleRestart() {
    setPath([])
    setInvalidReason(null)
  }

  return { path, completed, progress, invalidReason, stuck, canUndo, canRestart, handleDotClick, handleUndo, handleRestart }
}
