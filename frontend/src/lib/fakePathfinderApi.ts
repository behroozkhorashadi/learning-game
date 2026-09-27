/**
 * Test-only: an in-memory stand-in for the backend's per-profile Pathfinder
 * endpoints (`/api/profiles/{id}/pathfinder/...`), installed as
 * `global.fetch`. Mirrors the server's behavior closely enough that
 * component tests can save, reload, and inspect state the way the real app
 * does, without each test hand-rolling fetch mocks.
 */

import { vi } from 'vitest'
import type { PathfinderCustomMap } from '../types/generated'

export interface FakePathfinderApi {
  completions: Map<number, string[]>
  maps: PathfinderCustomMap[]
  /** Author names for the published-maps listing, keyed by profile id. */
  profileNames: Map<number, string>
  /** When true, every request fails with a 500 — for error-state tests. */
  failing: boolean
  fetch: ReturnType<typeof vi.fn>
}

const COMPLETIONS = /^\/api\/profiles\/(\d+)\/pathfinder\/completions$/
const PUBLISHED = /^\/api\/pathfinder\/published-maps$/
const MAPS = /^\/api\/profiles\/(\d+)\/pathfinder\/maps(?:\/([^/]+))?$/

function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response
}

export function installFakePathfinderApi(): FakePathfinderApi {
  let clock = 0
  const api: FakePathfinderApi = {
    completions: new Map(),
    maps: [],
    profileNames: new Map(),
    failing: false,
    fetch: vi.fn(),
  }

  api.fetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (api.failing) return json({ detail: 'server down' }, 500)
    const url = String(input)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(init.body as string) : undefined

    const completionsMatch = url.match(COMPLETIONS)
    if (completionsMatch) {
      const profileId = Number(completionsMatch[1])
      const ids = api.completions.get(profileId) ?? []
      if (method === 'POST') {
        for (const id of body.level_ids as string[]) if (!ids.includes(id)) ids.push(id)
        api.completions.set(profileId, ids)
      }
      return json([...ids])
    }

    if (PUBLISHED.test(url)) {
      const published = api.maps
        .filter((m) => m.published)
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      return json(
        published.map((m) => ({
          id: m.id,
          name: m.name,
          difficulty: m.difficulty,
          rows: m.rows,
          columns: m.columns,
          dots: m.dots,
          author_profile_id: m.profile_id,
          author_name: api.profileNames.get(m.profile_id) ?? `Player ${m.profile_id}`,
          created_at: m.created_at,
        })),
      )
    }

    const mapsMatch = url.match(MAPS)
    if (mapsMatch) {
      const profileId = Number(mapsMatch[1])
      const mapId = mapsMatch[2] ? decodeURIComponent(mapsMatch[2]) : undefined
      if (!mapId && method === 'GET') {
        const own = api.maps.filter((m) => m.profile_id === profileId)
        return json(own.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')))
      }
      if (!mapId && method === 'POST') {
        clock += 1
        const row: PathfinderCustomMap = {
          ...body,
          profile_id: profileId,
          published: false,
          created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString(),
        }
        api.maps.push(row)
        return json(row, 201)
      }
      const row = api.maps.find((m) => m.id === mapId && m.profile_id === profileId)
      if (!row) return json({ detail: 'not found' }, 404)
      if (method === 'PATCH') {
        if (body.name != null) row.name = body.name
        if (body.published != null) row.published = body.published
        return json(row)
      }
      if (method === 'DELETE') {
        api.maps = api.maps.filter((m) => m !== row)
        return json(null, 204)
      }
    }

    throw new Error(`fakePathfinderApi: unexpected ${method} ${url}`)
  })

  global.fetch = api.fetch as unknown as typeof fetch
  return api
}
