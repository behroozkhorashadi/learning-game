/**
 * Pathfinder: No Way Back — level-select unlock progress.
 *
 * Which curated levels a kid has finished is stored server-side per profile
 * (`LevelProgressStore`, over `/api/profiles/{id}/pathfinder/completions`),
 * so progress follows the profile rather than whichever browser they played
 * on. Unlocking isn't stored at all: it's derived from completions here.
 */

import type { DotPuzzle } from './pathfinder_state.pure.lib.ts'

export interface LevelStatus {
  readonly puzzle: DotPuzzle
  readonly completed: boolean
  /** The first level in `orderedLevels` is always unlocked; each level
   * after that unlocks once the one immediately before it is completed. */
  readonly unlocked: boolean
}

export function computeLevelStatuses(orderedLevels: readonly DotPuzzle[], completedIds: ReadonlySet<string>): readonly LevelStatus[] {
  return orderedLevels.map((puzzle, i) => {
    const previous = orderedLevels[i - 1]
    return { puzzle, completed: completedIds.has(puzzle.id), unlocked: previous === undefined || completedIds.has(previous.id) }
  })
}
