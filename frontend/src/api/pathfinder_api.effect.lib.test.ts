import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { HttpFetch, HttpResponse } from './http.pure.lib.ts'
import { bindPathfinderApi, type PathfinderApi, type PathfinderPuzzleDraft } from './pathfinder_api.effect.lib.ts'

/**
 * An in-memory stand-in for the backend's Pathfinder endpoints at the HTTP
 * level, so these tests check the adapter's URLs, bodies, and parsing.
 */
interface ServerRow {
  id: string
  name: string
  difficulty: string
  rows: number
  columns: number
  dots: { row: number; col: number }[]
  profile_id: number
  published: boolean
  created_at: string
}

/** What the adapter sends; the fake server parses it the way FastAPI would. */
const requestSchema = z.object({
  level_ids: z.array(z.string()).optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  difficulty: z.string().optional(),
  rows: z.number().optional(),
  columns: z.number().optional(),
  dots: z.array(z.object({ row: z.number(), col: z.number() })).optional(),
  published: z.boolean().optional(),
})

function fakeHttp() {
  let clock = 0
  const maps: ServerRow[] = []
  const requests: string[] = []
  const state = { completions: new Map<number, string[]>(), maps, failing: false, requests }
  const COMPLETIONS = /^\/api\/profiles\/(\d+)\/pathfinder\/completions$/
  const MAPS = /^\/api\/profiles\/(\d+)\/pathfinder\/maps(?:\/([^/]+))?$/
  const respond = (body: unknown, status = 200): HttpResponse => ({ ok: status < 400, status, json: () => Promise.resolve(body) })
  const newestFirst = (rows: ServerRow[]): ServerRow[] => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))

  const fetch: HttpFetch = (url, init) => {
    state.requests.push(`${init.method} ${url}`)
    if (state.failing) return Promise.resolve(respond({ detail: 'down' }, 500))
    const body = requestSchema.parse(init.body === undefined ? {} : JSON.parse(init.body))

    const completions = COMPLETIONS.exec(url)
    if (completions !== null) {
      const profileId = Number(completions[1])
      const ids = state.completions.get(profileId) ?? []
      if (init.method === 'POST') for (const id of body.level_ids ?? []) if (!ids.includes(id)) ids.push(id)
      state.completions.set(profileId, ids)
      return Promise.resolve(respond([...ids]))
    }
    if (url === '/api/pathfinder/published-maps') {
      return Promise.resolve(
        respond(newestFirst(state.maps.filter((m) => m.published)).map((m) => ({ ...m, author_profile_id: m.profile_id, author_name: `Player ${String(m.profile_id)}` }))),
      )
    }
    const maps = MAPS.exec(url)
    if (maps !== null) {
      const profileId = Number(maps[1])
      const mapId = maps[2] === undefined ? undefined : decodeURIComponent(maps[2])
      if (mapId === undefined && init.method === 'GET') return Promise.resolve(respond(newestFirst(state.maps.filter((m) => m.profile_id === profileId))))
      if (mapId === undefined && init.method === 'POST') {
        clock += 1
        const row: ServerRow = {
          id: body.id ?? '',
          name: body.name ?? '',
          difficulty: body.difficulty ?? '',
          rows: body.rows ?? 0,
          columns: body.columns ?? 0,
          dots: body.dots ?? [],
          profile_id: profileId,
          published: false,
          created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString(),
        }
        state.maps.push(row)
        return Promise.resolve(respond(row, 201))
      }
      const row = state.maps.find((m) => m.id === mapId && m.profile_id === profileId)
      if (row === undefined) return Promise.resolve(respond({ detail: 'not found' }, 404))
      if (init.method === 'PATCH') {
        if (body.name !== undefined) row.name = body.name
        if (body.published !== undefined) row.published = body.published
        return Promise.resolve(respond(row))
      }
      state.maps = state.maps.filter((m) => m !== row)
      return Promise.resolve(respond(null, 204))
    }
    throw new Error(`unexpected ${init.method} ${url}`)
  }
  return { fetch, state }
}

function puzzle(id: string, name = 'My Puzzle'): PathfinderPuzzleDraft {
  return { id, name, difficulty: 'easy', rows: 2, columns: 2, dots: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 1, col: 0 }] }
}

describe('bindPathfinderApi', () => {
  let http: ReturnType<typeof fakeHttp>
  let api: PathfinderApi

  beforeEach(() => {
    http = fakeHttp()
    api = bindPathfinderApi({ fetch: http.fetch, baseUrl: '' })
  })

  describe('completions', () => {
    it('starts empty, then records a level and resolves to the updated set', async () => {
      expect(await api.listCompletions(1)).toEqual(new Set())
      expect(await api.addCompletion(1, 'a')).toEqual(new Set(['a']))
      expect(await api.listCompletions(1)).toEqual(new Set(['a']))
      expect(http.state.requests).toContain('POST /api/profiles/1/pathfinder/completions')
    })

    it('scopes progress per profile', async () => {
      await api.addCompletion(1, 'a')
      expect(await api.listCompletions(2)).toEqual(new Set())
    })
  })

  describe('maps', () => {
    it('saves a map and lists it back with createdAt and published: false', async () => {
      const saved = await api.saveMap(1, puzzle('custom-1'))
      expect(saved.puzzle).toEqual(puzzle('custom-1'))
      expect(saved.published).toBe(false)
      expect(saved.createdAt).toBeTruthy()
      expect(await api.listMaps(1)).toEqual([saved])
    })

    it('sends a missing name as empty', async () => {
      const { name: _, ...unnamed } = puzzle('custom-1')
      expect((await api.saveMap(1, unnamed)).puzzle.name).toBe('')
    })

    it('lists most recently created first, and keeps profiles apart', async () => {
      await api.saveMap(1, puzzle('custom-1', 'First'))
      await api.saveMap(1, puzzle('custom-2', 'Second'))
      await api.saveMap(1, puzzle('custom-3', 'Third'))
      expect((await api.listMaps(1)).map((r) => r.puzzle.name)).toEqual(['Third', 'Second', 'First'])
      expect(await api.listMaps(2)).toEqual([])
    })

    it('deletes only the targeted map, by an URL-encoded id', async () => {
      await api.saveMap(1, puzzle('custom-1'))
      await api.saveMap(1, puzzle('custom 2'))
      await api.deleteMap(1, 'custom 2')
      expect((await api.listMaps(1)).map((r) => r.puzzle.id)).toEqual(['custom-1'])
      expect(http.state.requests).toContain('DELETE /api/profiles/1/pathfinder/maps/custom%202')
    })

    it('renames without touching id, createdAt, or published', async () => {
      const saved = await api.saveMap(1, puzzle('custom-1', 'Old Name'))
      await api.setMapPublished(1, 'custom-1', true)
      await api.renameMap(1, 'custom-1', 'New Name')
      const [only] = await api.listMaps(1)
      expect(only).toEqual({ ...saved, puzzle: { ...saved.puzzle, name: 'New Name' }, published: true })
    })

    it('lists published maps from every profile with the author', async () => {
      await api.saveMap(1, puzzle('custom-1'))
      await api.saveMap(2, puzzle('custom-2'))
      await api.setMapPublished(2, 'custom-2', true)
      expect(await api.listPublishedMaps()).toEqual([{ puzzle: puzzle('custom-2'), authorProfileId: 2, authorName: 'Player 2' }])
    })
  })

  it('rejects with the method, path, and status when the server fails', async () => {
    http.state.failing = true
    await expect(api.listCompletions(1)).rejects.toThrow('GET /api/profiles/1/pathfinder/completions failed with HTTP 500')
    await expect(api.saveMap(1, puzzle('custom-1'))).rejects.toThrow('HTTP 500')
    await expect(api.renameMap(1, 'custom-1', 'x')).rejects.toThrow('HTTP 500')
    await expect(api.listPublishedMaps()).rejects.toThrow('HTTP 500')
  })

  it('rejects a map with an unknown difficulty instead of rendering it', async () => {
    const fetch: HttpFetch = () =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ ...puzzle('custom-1'), difficulty: 'impossible', profile_id: 1, published: false, created_at: '' }]) })
    await expect(bindPathfinderApi({ fetch, baseUrl: '' }).listMaps(1)).rejects.toThrow('unexpected body')
  })
})
