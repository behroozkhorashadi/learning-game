import type { ComponentType, ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { PathfinderPlayPanel } from './pathfinder_play_panel.pure.ui.tsx'
import type { DotPuzzle, ScheduleTimeout } from './pathfinder_state.pure.lib.ts'
import { usePathfinderPlay } from './use_pathfinder_play.pure.hook.ts'

/**
 * Standalone "play a single puzzle" screen for the map builder — testing a
 * just-built or saved custom map, with no level-select/unlock-progression
 * machinery attached (that's specific to the curated game, not to trying
 * out your own creation). Shares its move-validation/undo/restart/
 * completion logic with the real game via `usePathfinderPlay`.
 */

export interface PathfinderPlayTestProps {
  readonly puzzle: DotPuzzle
  readonly onBack: () => void
  /** Defaults to the map-builder wording; the dev level gallery passes its
   * own so the label matches where "back" actually goes. */
  readonly backLabel?: string
}

export interface PathfinderPlayTestDeps {
  readonly scheduleTimeout: ScheduleTimeout
}

export function bindPathfinderPlayTest({ scheduleTimeout }: PathfinderPlayTestDeps): ComponentType<PathfinderPlayTestProps> {
  function PathfinderPlayTest({ puzzle, onBack, backLabel = 'Back to Builder' }: PathfinderPlayTestProps): ReactElement {
    const play = usePathfinderPlay(puzzle, scheduleTimeout)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <PathfinderPlayPanel
          puzzle={puzzle}
          title={puzzle.name === undefined || puzzle.name === '' ? 'Your Map' : puzzle.name}
          play={play}
          completeMessage="Every dot connected! 🎉"
          actions={<DenButton label={backLabel} variant="quiet" onClick={onBack} />}
        />
      </div>
    )
  }
  return PathfinderPlayTest
}
