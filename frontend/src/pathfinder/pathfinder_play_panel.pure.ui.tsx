import type { ReactElement, ReactNode } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { PathfinderBoard } from './pathfinder_board.pure.ui.tsx'
import type { DotPuzzle } from './pathfinder_state.pure.lib.ts'
import type { PathfinderPlayState } from './use_pathfinder_play.pure.hook.ts'

/**
 * Playing one puzzle: title, progress, board, move feedback, and the Undo /
 * Restart controls. Shared by the game's play mode and the builder's
 * play-test view so the two look and behave the same. Props only: the
 * caller owns the play state (usePathfinderPlay) and any extra buttons.
 */

export interface PathfinderPlayPanelProps {
  readonly puzzle: DotPuzzle
  readonly title: string
  readonly play: PathfinderPlayState
  /** Shown once every dot is connected. */
  readonly completeMessage: string
  /** Buttons placed before Undo / Restart (Back, Next Level, ...). */
  readonly actions: ReactNode
}

export function PathfinderPlayPanel({ puzzle, title, play, completeMessage, actions }: PathfinderPlayPanelProps): ReactElement {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--fg-primary)' }}>{title}</div>
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
        {play.invalidReason !== null && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>{play.invalidReason}</span>}
        {play.invalidReason === null && play.stuck && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-warning)' }}>No legal move from here — try Undo or Restart.</span>}
      </div>

      {play.completed && <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--green-900)', textAlign: 'center' }}>{completeMessage}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {actions}
        <DenButton label="Undo" variant="quiet" onClick={play.handleUndo} disabled={!play.canUndo} />
        <DenButton label="Restart" variant="quiet" onClick={play.handleRestart} disabled={!play.canRestart} />
      </div>
    </>
  )
}
