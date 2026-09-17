/**
 * Pathfinder: No Way Back — persistence for player-built custom maps.
 *
 * No backend model exists for user-generated game content (and none is
 * being added here), so custom maps are stored client-side under a
 * namespaced localStorage key — same pattern as `gameAudio.ts`'s mute
 * preference (`equationOutbreak:audioMuted`). They're per-browser, not
 * synced anywhere.
 *
 * Each saved map is a `CustomMapRecord`, not a bare `DotPuzzle`: the My
 * Maps page needs to show when a map was made (and sort by it) and whether
 * it's been published, neither of which belongs on the core `DotPuzzle`
 * type every other part of the game uses. `published` is a local-only flag
 * for now — there's no backend endpoint yet for other players to actually
 * fetch a published map, so it's a placeholder for that future feature
 * rather than a working "share with others" mechanism today.
 *
 * A saved map's `id` is a random, stable UUID assigned once at save time,
 * independent of its name — renaming a map must never change its identity
 * (delete/rename/publish are all keyed by `id`).
 */

import type { DotPuzzle } from './pathfinderTypes'

const STORAGE_KEY = 'pathfinder:customMaps'

export interface CustomMapRecord {
  puzzle: DotPuzzle
  createdAt: string
  published: boolean
}

function readAll(): CustomMapRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(records: CustomMapRecord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Storage unavailable (private browsing, quota) — saving is best-effort;
    // the map still plays this session via the in-memory value the caller holds.
  }
}

/** Most recently created first. */
export function listCustomMaps(): CustomMapRecord[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function saveCustomMap(puzzle: DotPuzzle): CustomMapRecord {
  const records = readAll().filter((r) => r.puzzle.id !== puzzle.id)
  const record: CustomMapRecord = { puzzle, createdAt: new Date().toISOString(), published: false }
  records.push(record)
  writeAll(records)
  return record
}

export function deleteCustomMap(id: string): void {
  writeAll(readAll().filter((r) => r.puzzle.id !== id))
}

/** Changes only the display name — `id`, `createdAt`, and `published`
 * stay put, so this is a rename, not a re-save under a new identity. */
export function renameCustomMap(id: string, newName: string): void {
  const records = readAll()
  const record = records.find((r) => r.puzzle.id === id)
  if (!record) return
  record.puzzle = { ...record.puzzle, name: newName }
  writeAll(records)
}

export function setCustomMapPublished(id: string, published: boolean): void {
  const records = readAll()
  const record = records.find((r) => r.puzzle.id === id)
  if (!record) return
  record.published = published
  writeAll(records)
}

export function makeCustomMapId(): string {
  return `custom-${crypto.randomUUID()}`
}

/** Suggests "<username>_map1", "<username>_map2", ... — one past the
 * highest number already used for this username across every saved map on
 * this device, so the default name is always free without the builder
 * having to check for a collision themselves. */
export function nextDefaultMapName(username: string): string {
  const prefix = `${username}_map`
  const used = readAll()
    .map((r) => r.puzzle.name ?? '')
    .filter((name) => name.startsWith(prefix))
    .map((name) => Number(name.slice(prefix.length)))
    .filter((n) => Number.isInteger(n) && n > 0)
  const next = used.length > 0 ? Math.max(...used) + 1 : 1
  return `${prefix}${next}`
}
