/**
 * Pathfinder: No Way Back — level-select unlock progress.
 *
 * Which curated levels a kid has finished is stored server-side per profile
 * (`/api/profiles/{id}/pathfinder/completions`, see the backend's
 * `app/models/pathfinder.py`), so progress follows the profile rather than
 * whichever browser they played on. Unlocking isn't stored at all — it's
 * derived from completions by `computeLevelStatuses`.
 */

import type { DotPuzzle } from './pathfinderTypes'

function completionsUrl(profileId: number): string {
  return `/api/profiles/${profileId}/pathfinder/completions`
}

export async function fetchCompletedLevelIds(profileId: number): Promise<Set<string>> {
  const res = await fetch(completionsUrl(profileId))
  if (!res.ok) throw new Error(`loading Pathfinder progress failed: ${res.status}`)
  return new Set((await res.json()) as string[])
}

/** Records a finished level and resolves to the profile's full, updated
 * set of completed level ids. Recording an already-finished level is a
 * no-op on the server. */
export async function markLevelCompleted(profileId: number, levelId: string): Promise<Set<string>> {
  const res = await fetch(completionsUrl(profileId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level_ids: [levelId] }),
  })
  if (!res.ok) throw new Error(`saving Pathfinder progress failed: ${res.status}`)
  return new Set((await res.json()) as string[])
}

export interface LevelStatus {
  puzzle: DotPuzzle
  completed: boolean
  /** The first level in `orderedLevels` is always unlocked; each level
   * after that unlocks once the one immediately before it is completed. */
  unlocked: boolean
}

export function computeLevelStatuses(orderedLevels: DotPuzzle[], completedIds: Set<string>): LevelStatus[] {
  return orderedLevels.map((puzzle, i) => ({
    puzzle,
    completed: completedIds.has(puzzle.id),
    unlocked: i === 0 || completedIds.has(orderedLevels[i - 1].id),
  }))
}
