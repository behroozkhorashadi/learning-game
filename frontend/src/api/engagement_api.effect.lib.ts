import type { EngagementSpan } from '@app/engagement/engagement_state.pure.lib.ts'
import { z } from 'zod'
import { failureMessage, type HttpFetch } from './http.pure.lib.ts'
import type { components } from './openapi_schema.pure.lib.ts'

const PATH = '/api/engagement'

export interface EngagementApi {
  readonly record: (spans: readonly EngagementSpan[]) => Promise<void>
  readonly summary: (adminPassword: string) => Promise<readonly EngagementSummaryRecord[]>
}

const summarySchema = z
  .array(z.object({ area: z.string(), active_ms: z.number().int().nonnegative() }).readonly())
  .readonly() satisfies z.ZodType<readonly components['schemas']['EngagementSummary'][]>
export type EngagementSummaryRecord = z.infer<typeof summarySchema>[number]

export function bindEngagementApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): EngagementApi {
  return {
    record: async (spans) => {
      if (spans.length === 0) return
      const body: components['schemas']['EngagementBatch'] = { spans }
      const response = await fetch(`${baseUrl}${PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      })
      if (!response.ok) throw new Error(await failureMessage(response, `POST ${PATH}`))
    },
    summary: async (adminPassword) => {
      const path = '/api/admin/engagement'
      const response = await fetch(`${baseUrl}${path}`, { method: 'GET', headers: { Accept: 'application/json', 'X-Admin-Password': adminPassword } })
      if (!response.ok) throw new Error(await failureMessage(response, `GET ${path}`))
      const parsed = summarySchema.safeParse(await response.json())
      if (!parsed.success) throw new Error(`GET ${path} returned an unexpected body: ${parsed.error.message}`)
      return parsed.data
    },
  }
}
