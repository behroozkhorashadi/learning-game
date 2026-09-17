import { PathfinderBoard } from './PathfinderBoard'
import { DenButton } from './den/DenButton'
import { usePathfinderPlay } from '../lib/usePathfinderPlay'
import type { DotPuzzle } from '../lib/pathfinderTypes'

/**
 * Standalone "play a single puzzle" screen for the map builder — testing a
 * just-built or saved custom map, with no level-select/unlock-progression
 * machinery attached (that's specific to the curated game, not to trying
 * out your own creation). Shares its move-validation/undo/restart/
 * completion logic with the real game via `usePathfinderPlay`.
 */

interface Props {
  puzzle: DotPuzzle
  onBack: () => void
}

export function PathfinderPlayTest({ puzzle, onBack }: Props) {
  const play = usePathfinderPlay(puzzle)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--fg-primary)' }}>
          {puzzle.name || 'Your Map'}
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
        {play.invalidReason && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>{play.invalidReason}</span>}
        {!play.invalidReason && play.stuck && (
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>
            No legal move from here — try Undo or Restart.
          </span>
        )}
      </div>

      {play.completed && (
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--green-900)' }}>
          Every dot connected! 🎉
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <DenButton label="Back to Builder" variant="quiet" onClick={onBack} />
        <DenButton label="Undo" variant="quiet" onClick={play.handleUndo} disabled={!play.canUndo} />
        <DenButton label="Restart" variant="quiet" onClick={play.handleRestart} disabled={!play.canRestart} />
      </div>
    </div>
  )
}
