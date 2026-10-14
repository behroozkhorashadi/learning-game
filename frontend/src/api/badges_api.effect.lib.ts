import type { z } from 'zod'
import type { HttpFetch, HttpResponse } from './http.pure.lib.ts'
import { badgeListSchema, badgeSchema, profileStatsSchema, type BadgeRecord, type ProfileStatsRecord } from './badges_schema.pure.lib.ts'

/** Adapter for a profile's badges and stats. */
export interface BadgesApi {
  readonly badges: (profileId: number) => Promise<readonly BadgeRecord[]>
  readonly stats: (profileId: number) => Promise<ProfileStatsRecord>
  /** Earned badges the kid hasn't celebrated yet, oldest first. */
  readonly newBadges: (profileId: number) => Promise<readonly BadgeRecord[]>
  readonly markCelebrated: (profileId: number, key: string) => Promise<void>
  /** Paints the profile's own art for an earned badge; resolves when it's done. */
  readonly paint: (profileId: number, key: string) => Promise<BadgeRecord>
}

export function bindBadgesApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): BadgesApi {
  async function send(method: 'GET' | 'POST', path: string): Promise<HttpResponse> {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`${method} ${path} failed with HTTP ${String(response.status)}`)
    return response
  }
  async function parse<T>(method: 'GET' | 'POST', path: string, schema: z.ZodType<T>): Promise<T> {
    const response = await send(method, path)
    const result = schema.safeParse(await response.json())
    if (!result.success) throw new Error(`${method} ${path} returned an unexpected body: ${result.error.message}`)
    return result.data
  }
  const badgePath = (profileId: number, key: string): string => `/api/profiles/${String(profileId)}/badges/${encodeURIComponent(key)}`
  return {
    badges: (profileId) => parse('GET', `/api/profiles/${String(profileId)}/badges`, badgeListSchema),
    stats: (profileId) => parse('GET', `/api/profiles/${String(profileId)}/stats`, profileStatsSchema),
    newBadges: (profileId) => parse('GET', `/api/profiles/${String(profileId)}/badges/new`, badgeListSchema),
    markCelebrated: async (profileId, key) => {
      await send('POST', `${badgePath(profileId, key)}/celebrated`)
    },
    paint: (profileId, key) => parse('POST', `${badgePath(profileId, key)}/art`, badgeSchema),
  }
}
