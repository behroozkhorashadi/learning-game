import { useMemo, useState } from 'react'
import { PathfinderBoard } from '../components/PathfinderBoard'
import { PathfinderLevelSelect } from '../components/PathfinderLevelSelect'
import { PathfinderMapBuilder } from '../components/PathfinderMapBuilder'
import { DenButton } from '../components/den/DenButton'
import { ArrowLeftIcon } from '../components/icons'
import { ALL_LEVELS } from '../lib/pathfinderLevels'
import { computeLevelStatuses, getCompletedLevelIds, markLevelCompleted } from '../lib/pathfinderProgress'
import { usePathfinderPlay } from '../lib/usePathfinderPlay'
import type { DotPuzzle } from '../lib/pathfinderTypes'

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
 * maps within a session. Move validation/undo/restart/completion is shared
 * with the map builder's play-test view via `usePathfinderPlay`.
 */

const GAME_ID = 'pathfinder_no_way_back'

type Mode = 'select' | 'play' | 'build'

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

export function Pathfinder({ profileId, profileName, onBack }: Props) {
  const [mode, setMode] = useState<Mode>('select')
  const [puzzle, setPuzzle] = useState<DotPuzzle>(ALL_LEVELS[0])
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => getCompletedLevelIds(profileId))

  const statuses = useMemo(() => computeLevelStatuses(ALL_LEVELS, completedIds), [completedIds])
  const currentIndex = ALL_LEVELS.findIndex((p) => p.id === puzzle.id)
  const nextLevel = currentIndex >= 0 ? ALL_LEVELS[currentIndex + 1] : undefined

  const play = usePathfinderPlay(puzzle, () => setCompletedIds(markLevelCompleted(profileId, puzzle.id)))

  function playLevel(levelId: string) {
    const level = ALL_LEVELS.find((p) => p.id === levelId)
    if (!level) return
    setPuzzle(level)
    setMode('play')
  }

  function handleBackToMap() {
    setMode('select')
  }

  function handleTopBack() {
    if (mode === 'play' || mode === 'build') setMode('select')
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

        {mode === 'select' && (
          <PathfinderLevelSelect statuses={statuses} onSelect={playLevel} onBuild={() => setMode('build')} />
        )}

        {mode === 'build' && <PathfinderMapBuilder username={profileName || 'Player'} />}

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
                  color: play.completed ? 'var(--green-900)' : 'var(--fg-secondary)',
                  background: play.completed ? 'var(--status-positive-bg)' : 'var(--gray-100)',
                  border: `1px solid ${play.completed ? 'var(--status-positive-border)' : 'var(--border-default)'}`,
                  borderRadius: 9999,
                  padding: '6px 14px',
                }}
              >
                {play.progress.visited} / {play.progress.total} dots connected
              </div>
            </div>

            <PathfinderBoard puzzle={puzzle} path={play.path} onDotClick={play.handleDotClick} disabled={play.completed} />

            <div style={{ minHeight: 24, textAlign: 'center' }} aria-live="polite">
              {play.invalidReason && (
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>{play.invalidReason}</span>
              )}
              {!play.invalidReason && play.stuck && (
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>
                  No legal move from here — try Undo or Restart.
                </span>
              )}
            </div>

            {play.completed && (
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--green-900)', textAlign: 'center' }}>
                {nextLevel ? 'Every dot connected! 🎉' : "Every dot connected! You've finished every map! 🎉"}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {play.completed && nextLevel && <DenButton label="Next Level" variant="primary" onClick={() => playLevel(nextLevel.id)} />}
              {play.completed && <DenButton label="Back to Map" variant="quiet" onClick={handleBackToMap} />}
              <DenButton label="Undo" variant="quiet" onClick={play.handleUndo} disabled={!play.canUndo} />
              <DenButton label="Restart" variant="quiet" onClick={play.handleRestart} disabled={!play.canRestart} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { GAME_ID as PATHFINDER_GAME_ID }
