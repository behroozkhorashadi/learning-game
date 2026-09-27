/**
 * Pathfinder: No Way Back — persistence for player-built custom maps.
 *
 * Saved maps belong to a profile and are stored server-side
 * (`/api/profiles/{id}/pathfinder/maps`, see the backend's
 * `app/models/pathfinder.py`), so a kid's maps follow them to any browser
 * and one kid's maps don't show up in another kid's My Maps.
 *
 * Each saved map is a `CustomMapRecord`, not a bare `DotPuzzle`: the My
 * Maps page needs to show when a map was made (and sort by it) and whether
 * it's been published, neither of which belongs on the core `DotPuzzle`
 * type every other part of the game uses. Published maps from every
 * profile are listed by `listPublishedMaps` for the Published Maps screen.
 *
 * A saved map's `id` is a random, stable UUID assigned once at save time,
 * independent of its name — renaming a map must never change its identity
 * (delete/rename/publish are all keyed by `id`).
 */

import type { PathfinderCustomMap, PublishedPathfinderMap } from '../types/generated'
import { randomId } from './id'
import type { Difficulty, DotPuzzle } from './pathfinderTypes'

export interface CustomMapRecord {
  puzzle: DotPuzzle
  createdAt: string
  published: boolean
}

function mapsUrl(profileId: number, mapId?: string): string {
  const base = `/api/profiles/${profileId}/pathfinder/maps`
  return mapId ? `${base}/${encodeURIComponent(mapId)}` : base
}

function toRecord(row: PathfinderCustomMap): CustomMapRecord {
  return {
    puzzle: {
      id: row.id,
      name: row.name,
      difficulty: row.difficulty as Difficulty,
      rows: row.rows,
      columns: row.columns,
      dots: row.dots.map((d) => ({ row: d.row, col: d.col })),
    },
    createdAt: row.created_at ?? '',
    published: row.published ?? false,
  }
}

async function send(url: string, init: RequestInit, action: string): Promise<Response> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${action} failed: ${res.status}`)
  return res
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Most recently created first (the server's order). */
export async function listCustomMaps(profileId: number): Promise<CustomMapRecord[]> {
  const res = await send(mapsUrl(profileId), {}, 'loading saved maps')
  return ((await res.json()) as PathfinderCustomMap[]).map(toRecord)
}

export async function saveCustomMap(profileId: number, puzzle: DotPuzzle): Promise<CustomMapRecord> {
  const body = {
    id: puzzle.id,
    name: puzzle.name ?? '',
    difficulty: puzzle.difficulty,
    rows: puzzle.rows,
    columns: puzzle.columns,
    dots: puzzle.dots,
  }
  const res = await send(mapsUrl(profileId), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }, 'saving map')
  return toRecord((await res.json()) as PathfinderCustomMap)
}

export async function deleteCustomMap(profileId: number, id: string): Promise<void> {
  await send(mapsUrl(profileId, id), { method: 'DELETE' }, 'deleting map')
}

/** Changes only the display name — `id`, `createdAt`, and `published`
 * stay put, so this is a rename, not a re-save under a new identity. */
export async function renameCustomMap(profileId: number, id: string, newName: string): Promise<void> {
  await send(mapsUrl(profileId, id), { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ name: newName }) }, 'renaming map')
}

export async function setCustomMapPublished(profileId: number, id: string, published: boolean): Promise<void> {
  await send(mapsUrl(profileId, id), { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ published }) }, 'publishing map')
}

/** A map someone published, as the Published Maps screen shows it. */
export interface PublishedMapRecord {
  puzzle: DotPuzzle
  authorProfileId: number
  authorName: string
}

/** Every profile's published maps, newest first. An unpublished map is
 * simply absent. */
export async function listPublishedMaps(): Promise<PublishedMapRecord[]> {
  const res = await send('/api/pathfinder/published-maps', {}, 'loading published maps')
  return ((await res.json()) as PublishedPathfinderMap[]).map((row) => ({
    puzzle: {
      id: row.id,
      name: row.name,
      difficulty: row.difficulty as Difficulty,
      rows: row.rows,
      columns: row.columns,
      dots: row.dots.map((d) => ({ row: d.row, col: d.col })),
    },
    authorProfileId: row.author_profile_id,
    authorName: row.author_name,
  }))
}

export function makeCustomMapId(): string {
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
  return `${prefix}${next}`
}
