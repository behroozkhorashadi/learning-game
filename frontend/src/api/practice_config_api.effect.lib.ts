import { failureMessage, type HttpFetch } from './http.pure.lib.ts'
import { practiceConfigSchema, type PracticeConfigRecord, type PracticeConfigUpsert } from './practice_config_schema.pure.lib.ts'

/** Adapter for a profile's per-game practice settings (GET/PUT/DELETE /api/practice-config). */

export interface PracticeConfigApi {
  /** The saved settings, or null when the profile has none for this game (404). */
  readonly get: (profileId: number, gameId: string) => Promise<PracticeConfigRecord | null>
  readonly save: (config: PracticeConfigUpsert) => Promise<void>
  /** Back to automatic difficulty. */
  readonly clear: (profileId: number, gameId: string) => Promise<void>
}

const PATH = '/api/practice-config'

export function bindPracticeConfigApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): PracticeConfigApi {
  const url = (profileId: number, gameId: string): string => `${baseUrl}${PATH}?${new URLSearchParams({ profile_id: String(profileId), game_id: gameId }).toString()}`
  return {
    get: async (profileId, gameId) => {
      const response = await fetch(url(profileId, gameId), { method: 'GET', headers: { Accept: 'application/json' } })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`GET ${PATH} failed with HTTP ${String(response.status)}`)
      const result = practiceConfigSchema.safeParse(await response.json())
      if (!result.success) throw new Error(`GET ${PATH} returned an unexpected body: ${result.error.message}`)
      return result.data
    },
    save: async (config) => {
      const response = await fetch(`${baseUrl}${PATH}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      if (!response.ok) throw new Error(await failureMessage(response, `PUT ${PATH}`))
    },
    clear: async (profileId, gameId) => {
      const response = await fetch(url(profileId, gameId), { method: 'DELETE', headers: {} })
      if (!response.ok) throw new Error(`DELETE ${PATH} failed with HTTP ${String(response.status)}`)
    },
  }
}
