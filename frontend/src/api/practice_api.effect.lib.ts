import type { HttpFetch } from './http.pure.lib.ts'
import type { components } from './openapi_schema.pure.lib.ts'
import { attemptSchema, itemSchema, type AttemptBody, type AttemptRecord, type ItemRecord } from './practice_schema.pure.lib.ts'

/**
 * Adapter for the practice loop (PRD §6): the server picks the next item and
 * level; the client posts each attempt's telemetry core, an optional star
 * rating, and the parent's verification of handwritten work.
 */
export interface PracticeApi {
  readonly nextItem: (query: { readonly profileId: number; readonly gameId: string; readonly sessionId: string }) => Promise<ItemRecord>
  readonly recordAttempt: (attempt: AttemptBody) => Promise<AttemptRecord>
  readonly rate: (rating: components['schemas']['RatingCreate']) => Promise<void>
  readonly verify: (verification: components['schemas']['VerificationCreate']) => Promise<void>
}

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' }

export function bindPracticeApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): PracticeApi {
  async function post(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
    if (!response.ok) throw new Error(`POST ${path} failed with HTTP ${String(response.status)}`)
    return response.json()
  }

  return {
    nextItem: async ({ profileId, gameId, sessionId }) => {
      const query = new URLSearchParams({ profile_id: String(profileId), game_id: gameId, session_id: sessionId })
      const response = await fetch(`${baseUrl}/api/items/next?${query.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`GET /api/items/next failed with HTTP ${String(response.status)}`)
      const result = itemSchema.safeParse(await response.json())
      if (!result.success) throw new Error(`GET /api/items/next returned an unexpected body: ${result.error.message}`)
      return result.data
    },
    recordAttempt: async (attempt) => {
      const result = attemptSchema.safeParse(await post('/api/attempts', attempt))
      if (!result.success) throw new Error(`POST /api/attempts returned an unexpected body: ${result.error.message}`)
      return result.data
    },
    rate: async (rating) => {
      await post('/api/ratings', rating)
    },
    verify: async (verification) => {
      await post('/api/verifications', verification)
    },
  }
}
