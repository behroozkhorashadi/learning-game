/**
 * Pathfinder: No Way Back — persistence for player-built custom maps.
 *
 * No backend model exists for user-generated game content (and none is
 * being added here), so custom maps are stored client-side under a
 * namespaced localStorage key — same pattern as `gameAudio.ts`'s mute
 * preference (`equationOutbreak:audioMuted`). They're per-browser, not
 * synced anywhere, which is the right tradeoff for a "try building one"
 * feature rather than a shared level bank.
 */

import type { DotPuzzle } from './pathfinderTypes'

const STORAGE_KEY = 'pathfinder:customMaps'

function readAll(): DotPuzzle[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(maps: DotPuzzle[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(maps))
  } catch {
    // Storage unavailable (private browsing, quota) — saving is best-effort;
    // the map still plays this session via the in-memory value the caller holds.
  }
}

export function listCustomMaps(): DotPuzzle[] {
  return readAll()
}

export function saveCustomMap(puzzle: DotPuzzle): void {
  const maps = readAll().filter((m) => m.id !== puzzle.id)
  maps.push(puzzle)
  writeAll(maps)
}

export function deleteCustomMap(id: string): void {
  writeAll(readAll().filter((m) => m.id !== id))
}

export function makeCustomMapId(): string {
  return `custom-${crypto.randomUUID()}`
}
