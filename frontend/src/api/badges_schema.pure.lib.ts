import { z } from 'zod'
import type { components } from './openapi_schema.pure.lib.ts'

export const BADGE_TIERS = ['bronze', 'silver', 'gold', 'legend'] as const
export const BADGE_CATEGORIES = ['streaks', 'days', 'time', 'rounds', 'accuracy', 'speed', 'games', 'explorer', 'creator', 'legend'] as const
export const ART_STATUSES = ['none', 'pending', 'ready', 'failed'] as const

/** A badge and whether this profile has earned it (`GET /api/profiles/{id}/badges`). */
export const badgeSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    /** How to earn it, said to the kid. */
    description: z.string(),
    art_url: z.string(),
    earned: z.boolean(),
    awarded_at: z.string().nullable().default(null),
    category: z.enum(BADGE_CATEGORIES),
    tier: z.enum(BADGE_TIERS),
    /** Why they got it ("You played 3 days in a row!"); null until earned. */
    earned_reason: z.string().nullable().default(null),
    progress: z.number().nullable().default(null),
    goal: z.number().nullable().default(null),
    earned_in_game: z.string().nullable().default(null),
    art_status: z.enum(ART_STATUSES),
    personal_art_url: z.string().nullable().default(null),
    celebrated: z.boolean(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['BadgeStatus']>

export const badgeListSchema = z.array(badgeSchema).readonly()

/** One local day the profile played. */
export const dayActivitySchema = z
  .object({
    day: z.string(),
    minutes: z.number(),
    rounds: z.number(),
    correct: z.number(),
    games: z.array(z.string()).readonly(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['DayActivity']>

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
    longest_streak: z.number(),
    total_minutes: z.number(),
    /** Days played in the last six weeks, newest first. */
    recent_days: z.array(dayActivitySchema).readonly(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['ProfileStats']>

export type BadgeRecord = z.infer<typeof badgeSchema>
export type BadgeTier = BadgeRecord['tier']
export type BadgeCategory = BadgeRecord['category']
export type DayActivityRecord = z.infer<typeof dayActivitySchema>
export type ProfileStatsRecord = z.infer<typeof profileStatsSchema>
