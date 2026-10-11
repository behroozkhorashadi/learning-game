import { z } from 'zod'
import { failureMessage, type HttpFetch } from './http.pure.lib.ts'
import type { components } from './openapi_schema.pure.lib.ts'

/**
 * Adapter for Zombie Horde's round recordings (`/api/profiles/{id}/horde/replays`,
 * backend `app/replays/`). The server keeps each profile's last few rounds.
 * The recording's shape is the horde feature's; this adapter only carries it.
 */

const summarySchema = z
  .object({
    id: z.string(),
    profile_id: z.number().int(),
    created_at: z.string(),
    outcome: z.string(),
    duration_ms: z.number().int(),
    flags: z.number().int(),
    size_bytes: z.number().int(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['ReplaySummary']>

export type ReplaySummaryRecord = z.infer<typeof summarySchema>

export interface ReplaysApi {
  /** Keeps a round's recording (any JSON object). */
  readonly save: (profileId: number, replay: { readonly outcome: string; readonly duration_ms: number; readonly flags: number; readonly recording: object }) => Promise<ReplaySummaryRecord>
}

export function bindReplaysApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): ReplaysApi {
  return {
    save: async (profileId, replay) => {
      const path = `/api/profiles/${String(profileId)}/horde/replays`
      const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(replay) })
      if (!response.ok) throw new Error(await failureMessage(response, `POST ${path}`))
      const result = summarySchema.safeParse(await response.json())
      if (!result.success) throw new Error(`POST ${path} returned an unexpected body: ${result.error.message}`)
      return result.data
    },
  }
}
