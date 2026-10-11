import { z } from 'zod'
import type { HttpFetch, HttpResponse } from './http.pure.lib.ts'
import type { components } from './openapi_schema.pure.lib.ts'

/**
 * Adapter for the Pathfinder endpoints: per-profile level completions and
 * custom maps (`/api/profiles/{id}/pathfinder/...`, backend
 * `app/models/pathfinder.py`) and the cross-profile published-maps list.
 *
 * Stricter than the OpenAPI types on one point: `difficulty` is one of the
 * four tiers, not any string. A map with an unknown tier is a visible error
 * instead of a card the game can't label.
 */

const difficultySchema = z.enum(['easy', 'medium', 'hard', 'legendary'])
const gridPositionSchema = z.object({ row: z.number().int(), col: z.number().int() }).readonly() satisfies z.ZodType<components['schemas']['GridPosition']>

const customMapSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    difficulty: difficultySchema,
    rows: z.number().int(),
    columns: z.number().int(),
    dots: z.array(gridPositionSchema).readonly(),
    profile_id: z.number().int(),
    published: z.boolean().default(false),
    created_at: z.string().default(''),
  })
  .readonly() satisfies z.ZodType<components['schemas']['PathfinderCustomMap']>

const publishedMapSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    difficulty: difficultySchema,
    rows: z.number().int(),
    columns: z.number().int(),
    dots: z.array(gridPositionSchema).readonly(),
    author_profile_id: z.number().int(),
    author_name: z.string(),
    created_at: z.string(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['PublishedPathfinderMap']>

const completionsSchema = z.array(z.string()).readonly()

export type PathfinderDifficulty = z.infer<typeof difficultySchema>

/** A board as the API carries it. Features keep their own structurally identical `DotPuzzle`. */
export interface PathfinderPuzzleRecord {
  readonly id: string
  readonly name: string
  readonly difficulty: PathfinderDifficulty
  readonly rows: number
  readonly columns: number
  readonly dots: readonly { readonly row: number; readonly col: number }[]
}

export interface PathfinderMapRecord {
  readonly puzzle: PathfinderPuzzleRecord
  readonly createdAt: string
  readonly published: boolean
}

export interface PathfinderPublishedMapRecord {
  readonly puzzle: PathfinderPuzzleRecord
  readonly authorProfileId: number
  readonly authorName: string
}

/** The board to save: `name` may be absent while drafting, and is sent as ''. */
export interface PathfinderPuzzleDraft {
  readonly id: string
  readonly name?: string
  readonly difficulty: PathfinderDifficulty
  readonly rows: number
  readonly columns: number
  readonly dots: readonly { readonly row: number; readonly col: number }[]
}

export interface PathfinderApi {
  /** The ids of every level (curated or custom) the profile has finished. */
  readonly listCompletions: (profileId: number) => Promise<ReadonlySet<string>>
  /** Records a finished level; resolves to the profile's full, updated set. Re-recording is a no-op on the server. */
  readonly addCompletion: (profileId: number, levelId: string) => Promise<ReadonlySet<string>>
  /** The profile's saved maps, most recently created first (the server's order). */
  readonly listMaps: (profileId: number) => Promise<readonly PathfinderMapRecord[]>
  readonly saveMap: (profileId: number, puzzle: PathfinderPuzzleDraft) => Promise<PathfinderMapRecord>
  readonly deleteMap: (profileId: number, mapId: string) => Promise<void>
  /** Changes only the display name: id, createdAt, and published stay put. */
  readonly renameMap: (profileId: number, mapId: string, name: string) => Promise<void>
  readonly setMapPublished: (profileId: number, mapId: string, published: boolean) => Promise<void>
  /** Every profile's published maps, newest first. */
  readonly listPublishedMaps: () => Promise<readonly PathfinderPublishedMapRecord[]>
}

const PUBLISHED_PATH = '/api/pathfinder/published-maps'
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' }

function completionsPath(profileId: number): string {
  return `/api/profiles/${String(profileId)}/pathfinder/completions`
}

function mapsPath(profileId: number, mapId?: string): string {
  const base = `/api/profiles/${String(profileId)}/pathfinder/maps`
  return mapId === undefined ? base : `${base}/${encodeURIComponent(mapId)}`
}

function toMapRecord(row: z.infer<typeof customMapSchema>): PathfinderMapRecord {
  const { id, name, difficulty, rows, columns, dots } = row
  return { puzzle: { id, name, difficulty, rows, columns, dots }, createdAt: row.created_at, published: row.published }
}

export function bindPathfinderApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): PathfinderApi {
  async function call(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<HttpResponse> {
    const response = await fetch(`${baseUrl}${path}`, body === undefined ? { method, headers: { Accept: 'application/json' } } : { method, headers: JSON_HEADERS, body: JSON.stringify(body) })
    if (!response.ok) throw new Error(`${method} ${path} failed with HTTP ${String(response.status)}`)
    return response
  }

  async function parsed<T>(response: HttpResponse, schema: z.ZodType<T>, what: string): Promise<T> {
    const result = schema.safeParse(await response.json())
    if (!result.success) throw new Error(`${what} returned an unexpected body: ${result.error.message}`)
    return result.data
  }

  return {
    listCompletions: async (profileId) => {
      const path = completionsPath(profileId)
      return new Set(await parsed(await call('GET', path), completionsSchema, `GET ${path}`))
    },
    addCompletion: async (profileId, levelId) => {
      const path = completionsPath(profileId)
      const body: components['schemas']['PathfinderCompletionsCreate'] = { level_ids: [levelId] }
      return new Set(await parsed(await call('POST', path, body), completionsSchema, `POST ${path}`))
    },
    listMaps: async (profileId) => {
      const path = mapsPath(profileId)
      return (await parsed(await call('GET', path), z.array(customMapSchema).readonly(), `GET ${path}`)).map(toMapRecord)
    },
    saveMap: async (profileId, puzzle) => {
      const path = mapsPath(profileId)
      const body: components['schemas']['PathfinderCustomMapCreate'] = {
        id: puzzle.id,
        name: puzzle.name ?? '',
        difficulty: puzzle.difficulty,
        rows: puzzle.rows,
        columns: puzzle.columns,
        dots: puzzle.dots.map(({ row, col }) => ({ row, col })),
      }
      return toMapRecord(await parsed(await call('POST', path, body), customMapSchema, `POST ${path}`))
    },
    deleteMap: async (profileId, mapId) => {
      await call('DELETE', mapsPath(profileId, mapId))
    },
    renameMap: async (profileId, mapId, name) => {
      const body: components['schemas']['PathfinderCustomMapUpdate'] = { name }
      await call('PATCH', mapsPath(profileId, mapId), body)
    },
    setMapPublished: async (profileId, mapId, published) => {
      const body: components['schemas']['PathfinderCustomMapUpdate'] = { published }
      await call('PATCH', mapsPath(profileId, mapId), body)
    },
    listPublishedMaps: async () => {
      const rows = await parsed(await call('GET', PUBLISHED_PATH), z.array(publishedMapSchema).readonly(), `GET ${PUBLISHED_PATH}`)
      return rows.map((row) => {
        const { id, name, difficulty, rows: boardRows, columns, dots } = row
        return { puzzle: { id, name, difficulty, rows: boardRows, columns, dots }, authorProfileId: row.author_profile_id, authorName: row.author_name }
      })
    },
  }
}
