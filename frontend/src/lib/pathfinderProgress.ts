/**
 * Pathfinder: No Way Back — level-select unlock progress.
 *
 * No backend model exists for per-player progress (and none is being added
 * here), so completed levels are stored client-side under a namespaced
 * localStorage key — same pattern as `pathfinderCustomMaps.ts` and
 * `gameAudio.ts`'s mute preference. Scoped per `profileId` (this app lets
 * several kids share one browser via `ProfilePicker`) so one kid finishing
 * levels doesn't silently unlock them for another kid on the same device.
 */

import type { DotPuzzle } from './pathfinderTypes'

const STORAGE_PREFIX = 'pathfinder:completedLevelIds'

function storageKey(profileId: number): string {
  return `${STORAGE_PREFIX}:${profileId}`
}

export function getCompletedLevelIds(profileId: number): Set<string> {
  try {
    const raw = window.localStorage.getItem(storageKey(profileId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export function markLevelCompleted(profileId: number, levelId: string): Set<string> {
  const ids = getCompletedLevelIds(profileId)
  ids.add(levelId)
  try {
    window.localStorage.setItem(storageKey(profileId), JSON.stringify([...ids]))
  } catch {
    // Storage unavailable — the unlock still applies for the rest of this
    // session via the returned set; it just won't survive a reload.
  }
  return ids
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
