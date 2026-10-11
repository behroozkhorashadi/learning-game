import { z } from 'zod'
import type { components } from './openapi_schema.pure.lib.ts'

/** A badge and whether this profile has earned it (`GET /api/profiles/{id}/badges`). */
export const badgeSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    art_url: z.string(),
    earned: z.boolean(),
    awarded_at: z.string().nullable().default(null),
  })
  .readonly() satisfies z.ZodType<components['schemas']['BadgeStatus']>

export const badgeListSchema = z.array(badgeSchema).readonly()

/** A profile's activity summary (`GET /api/profiles/{id}/stats`). */
export const profileStatsSchema = z
  .object({
    total_stars: z.number(),
    day_streak: z.number(),
    minutes_this_week: z.number(),
    most_played_game: z.string().nullable().default(null),
    avg_rating: z.number().nullable().default(null),
    last_session_at: z.string().nullable().default(null),
    progress_delta_pct: z.number().nullable().default(null),
  })
  .readonly() satisfies z.ZodType<components['schemas']['ProfileStats']>

export type BadgeRecord = z.infer<typeof badgeSchema>
export type ProfileStatsRecord = z.infer<typeof profileStatsSchema>
