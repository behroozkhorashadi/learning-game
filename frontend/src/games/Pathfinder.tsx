import { useEffect, useMemo, useRef, useState } from 'react'
import { PathfinderBoard } from '../components/PathfinderBoard'
import { PathfinderLevelSelect } from '../components/PathfinderLevelSelect'
import { DenButton } from '../components/den/DenButton'
import { ArrowLeftIcon } from '../components/icons'
import { checkMove, hasLegalMoveFrom, isPuzzleComplete, progressOf, rejectionMessage } from '../lib/pathfinderRules'
import { buildDotSet } from '../lib/pathfinderRules'
import { ALL_LEVELS } from '../lib/pathfinderLevels'
import { computeLevelStatuses, getCompletedLevelIds, markLevelCompleted } from '../lib/pathfinderProgress'
import type { DotPuzzle, GridPosition } from '../lib/pathfinderTypes'

/**
 * Pathfinder: No Way Back — connect every dot on the board with one
 * continuous path, moving only left/right/up/down, never revisiting a dot.
 *
 * A pure logic puzzle with no adaptive server-driven items (same shape as
 * `ClueMaster`): the backend module only exists so this shows up in
 * `GamePicker`; every level, the solver, and all game state live here.
 *
 * Levels are a single fixed, ordered list (`ALL_LEVELS`) rather than a
 * random per-difficulty draw: completing one unlocks the next
 * (`pathfinderProgress`), which is both the "map with locked levels"
 * feature and the fix for the random picker repeating the same handful of
 * maps within a session.
 */

const GAME_ID = 'pathfinder_no_way_back'
const INVALID_FEEDBACK_MS = 1500

type Mode = 'select' | 'play'

interface Props {
  profileId: number
  profileName?: string
  onBack: () => void
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Back"
      title="Back"
      onClick={onClick}
      style={{
        width: 56,
        height: 56,
        borderRadius: 9999,
        border: '2px solid var(--border-default)',
        background: 'var(--surface-default)',
        color: 'var(--fg-secondary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flex: 'none',
      }}
    >
      <ArrowLeftIcon />
    </button>
  )
}

export function Pathfinder({ profileId, onBack }: Props) {
  const [mode, setMode] = useState<Mode>('select')
  const [puzzle, setPuzzle] = useState<DotPuzzle>(ALL_LEVELS[0])
  const [path, setPath] = useState<GridPosition[]>([])
  const [invalidReason, setInvalidReason] = useState<string | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => getCompletedLevelIds(profileId))
  const invalidTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dotSet = useMemo(() => buildDotSet(puzzle), [puzzle])
  const completed = isPuzzleComplete(puzzle, path)
  const progress = progressOf(puzzle, path)
  const canUndo = path.length > 0
  const canRestart = path.length > 0
  const stuck = !completed && path.length > 0 && !hasLegalMoveFrom(dotSet, path)

  const statuses = useMemo(() => computeLevelStatuses(ALL_LEVELS, completedIds), [completedIds])
  const currentIndex = ALL_LEVELS.findIndex((p) => p.id === puzzle.id)
  const nextLevel = currentIndex >= 0 ? ALL_LEVELS[currentIndex + 1] : undefined

  useEffect(() => {
    return () => {
      if (invalidTimer.current) clearTimeout(invalidTimer.current)
    }
  }, [])

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
    if (isPuzzleComplete(puzzle, nextPath)) {
      setCompletedIds(markLevelCompleted(profileId, puzzle.id))
    }
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

  function playLevel(levelId: string) {
    const level = ALL_LEVELS.find((p) => p.id === levelId)
    if (!level) return
    setPuzzle(level)
    setPath([])
    setInvalidReason(null)
    setMode('play')
  }

  function handleBackToMap() {
    setMode('select')
  }

  function handleTopBack() {
    if (mode === 'play') setMode('select')
    else onBack()
  }

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <BackButton onClick={handleTopBack} />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--fg-primary)' }}>
            Pathfinder: No Way Back
          </div>
        </div>

        {mode === 'select' && <PathfinderLevelSelect statuses={statuses} onSelect={playLevel} />}

        {mode === 'play' && (
          <div
            style={{
              background: 'var(--surface-default)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 24,
              padding: '28px 24px',
              boxShadow: 'var(--elevation-300)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--fg-primary)' }}>
                {puzzle.name ?? 'Connect every dot'}
              </div>
              <div
                aria-live="polite"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 16,
                  color: completed ? 'var(--green-900)' : 'var(--fg-secondary)',
                  background: completed ? 'var(--status-positive-bg)' : 'var(--gray-100)',
                  border: `1px solid ${completed ? 'var(--status-positive-border)' : 'var(--border-default)'}`,
                  borderRadius: 9999,
                  padding: '6px 14px',
                }}
              >
                {progress.visited} / {progress.total} dots connected
              </div>
            </div>

            <PathfinderBoard puzzle={puzzle} path={path} onDotClick={handleDotClick} disabled={completed} />

            <div style={{ minHeight: 24, textAlign: 'center' }} aria-live="polite">
              {invalidReason && (
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>{invalidReason}</span>
              )}
              {!invalidReason && stuck && (
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>
                  No legal move from here — try Undo or Restart.
                </span>
              )}
            </div>

            {completed && (
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--green-900)', textAlign: 'center' }}>
                {nextLevel ? 'Every dot connected! 🎉' : "Every dot connected! You've finished every map! 🎉"}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {completed && nextLevel && <DenButton label="Next Level" variant="primary" onClick={() => playLevel(nextLevel.id)} />}
              {completed && <DenButton label="Back to Map" variant="quiet" onClick={handleBackToMap} />}
              <DenButton label="Undo" variant="quiet" onClick={handleUndo} disabled={!canUndo} />
              <DenButton label="Restart" variant="quiet" onClick={handleRestart} disabled={!canRestart} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { GAME_ID as PATHFINDER_GAME_ID }
