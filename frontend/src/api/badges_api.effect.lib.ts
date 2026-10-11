import type { z } from 'zod'
import type { HttpFetch } from './http.pure.lib.ts'
import { badgeListSchema, profileStatsSchema, type BadgeRecord, type ProfileStatsRecord } from './badges_schema.pure.lib.ts'

/** Adapter for a profile's badges and stats. */
export interface BadgesApi {
  readonly badges: (profileId: number) => Promise<readonly BadgeRecord[]>
  readonly stats: (profileId: number) => Promise<ProfileStatsRecord>
}

export function bindBadgesApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): BadgesApi {
  async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, { method: 'GET', headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`GET ${path} failed with HTTP ${String(response.status)}`)
    const result = schema.safeParse(await response.json())
    if (!result.success) throw new Error(`GET ${path} returned an unexpected body: ${result.error.message}`)
    return result.data
  }
  return {
    badges: (profileId) => get(`/api/profiles/${String(profileId)}/badges`, badgeListSchema),
    stats: (profileId) => get(`/api/profiles/${String(profileId)}/stats`, profileStatsSchema),
  }
}
