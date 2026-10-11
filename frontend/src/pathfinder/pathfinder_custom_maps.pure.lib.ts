/**
 * Pathfinder: No Way Back — naming and identity for player-built maps.
 *
 * Saved maps belong to a profile and are stored server-side (`MapLibrary`
 * in pathfinder_state.pure.lib.ts, over `/api/profiles/{id}/pathfinder/maps`),
 * so a kid's maps follow them to any browser and one kid's maps don't show
 * up in another kid's My Maps.
 *
 * A saved map's `id` is a random, stable UUID assigned once at save time,
 * independent of its name: renaming a map must never change its identity
 * (delete/rename/publish are all keyed by `id`). The `custom-` prefix keeps
 * it from colliding with a curated level id in the shared completions store.
 */

import type { CustomMapRecord } from './pathfinder_state.pure.lib.ts'

export function makeCustomMapId(randomId: () => string): string {
  return `custom-${randomId()}`
}

/** Suggests "<username>_map1", "<username>_map2", ... — one past the
 * highest number already used for this username among `existing`, so the
 * default name is always free without the builder having to check for a
 * collision themselves. */
export function nextDefaultMapName(username: string, existing: readonly CustomMapRecord[]): string {
  const prefix = `${username}_map`
  const used = existing
    .map((r) => r.puzzle.name ?? '')
    .filter((name) => name.startsWith(prefix))
    .map((name) => Number(name.slice(prefix.length)))
    .filter((n) => Number.isInteger(n) && n > 0)
  const next = used.length > 0 ? Math.max(...used) + 1 : 1
  return `${prefix}${String(next)}`
}
