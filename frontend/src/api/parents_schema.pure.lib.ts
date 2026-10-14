import { z } from 'zod'
import type { components } from './openapi_schema.pure.lib.ts'

/**
 * Parent accounts and the progress reports they read (backend/app/parents/).
 * Pure, so UI can import the types; the adapter that parses responses is
 * parents_api.effect.lib.ts.
 */

export const parentSchema = z
  .object({ id: z.number().int(), name: z.string(), created_at: z.string() })
  .readonly() satisfies z.ZodType<components['schemas']['ParentRead']>

export const parentListSchema = z.array(parentSchema).readonly()

export type ParentRecord = z.infer<typeof parentSchema>

export const TONES = ['celebrate', 'attention', 'info'] as const
export const AREAS = ['math', 'reading', 'puzzles', 'writing', 'other'] as const
export const SKILL_STATUSES = ['strong', 'steady', 'needs_work', 'new'] as const

const pct = z.number().int().nullable()
const ms = z.number().int().nullable()

export const insightSchema = z
  .object({
    tone: z.enum(TONES),
    title: z.string(),
    detail: z.string(),
    skill: z.string().nullable().default(null),
    game_id: z.string().nullable().default(null),
  })
  .readonly() satisfies z.ZodType<components['schemas']['Insight']>

export type Insight = z.infer<typeof insightSchema>

export const periodTotalsSchema = z
  .object({
    minutes: z.number().int(),
    active_days: z.number().int(),
    sittings: z.number().int(),
    problems: z.number().int(),
    correct: z.number().int(),
    accuracy_pct: pct,
    first_try_pct: pct,
    avg_sitting_minutes: z.number().int().nullable(),
    median_answer_ms: ms,
  })
  .readonly() satisfies z.ZodType<components['schemas']['PeriodTotals']>

export type PeriodTotals = z.infer<typeof periodTotalsSchema>

export const dayPointSchema = z
  .object({
    day: z.string(),
    minutes: z.number().int(),
    problems: z.number().int(),
    correct: z.number().int(),
    game_minutes: z.record(z.string(), z.number().int()).readonly(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['DayPoint']>

export type DayPoint = z.infer<typeof dayPointSchema>

export const hourCellSchema = z
  .object({ weekday: z.number().int(), hour: z.number().int(), minutes: z.number().int() })
  .readonly() satisfies z.ZodType<components['schemas']['HourCell']>

export type HourCell = z.infer<typeof hourCellSchema>

export const levelPointSchema = z.object({ at: z.string(), level: z.number().int() }).readonly() satisfies z.ZodType<components['schemas']['LevelPoint']>

export type LevelPoint = z.infer<typeof levelPointSchema>

export const gameStatSchema = z
  .object({
    game_id: z.string(),
    title: z.string(),
    icon: z.string(),
    area: z.enum(AREAS),
    minutes: z.number().int(),
    problems: z.number().int(),
    accuracy_pct: pct,
    first_try_pct: pct,
    median_answer_ms: ms,
    level: z.number().int().nullable(),
    max_level: z.number().int().nullable(),
    levels_gained: z.number().int(),
    level_history: z.array(levelPointSchema).readonly(),
    last_played_at: z.string().nullable(),
    rating: z.number().nullable(),
    note: z.string().nullable(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['GameStat']>

export type GameStat = z.infer<typeof gameStatSchema>

export const skillStatSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    area: z.enum(AREAS),
    problems: z.number().int(),
    accuracy_pct: pct,
    first_try_pct: pct,
    median_answer_ms: ms,
    previous_first_try_pct: pct,
    previous_median_answer_ms: ms,
    status: z.enum(SKILL_STATUSES),
  })
  .readonly() satisfies z.ZodType<components['schemas']['SkillStat']>

export type SkillStat = z.infer<typeof skillStatSchema>

export const factCellSchema = z
  .object({ operator: z.string(), left: z.number().int(), right: z.number().int(), attempts: z.number().int(), first_try: z.number().int() })
  .readonly() satisfies z.ZodType<components['schemas']['FactCell']>

export type FactCell = z.infer<typeof factCellSchema>

export const troubleSpotSchema = z
  .object({
    game_id: z.string(),
    game_title: z.string(),
    skill: z.string(),
    prompt: z.string(),
    answer: z.string(),
    attempts: z.number().int(),
    misses: z.number().int(),
    last_seen_at: z.string(),
    wrong_answers: z.array(z.string()).readonly(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['TroubleSpot']>

export type TroubleSpot = z.infer<typeof troubleSpotSchema>

export const weekPointSchema = z
  .object({
    week_start: z.string(),
    minutes: z.number().int(),
    problems: z.number().int(),
    math_first_try_pct: pct,
    reading_first_try_pct: pct,
    math_median_answer_ms: ms,
  })
  .readonly() satisfies z.ZodType<components['schemas']['WeekPoint']>

export type WeekPoint = z.infer<typeof weekPointSchema>

export const badgeEarnedSchema = z
  .object({ name: z.string(), tier: z.string(), awarded_at: z.string() })
  .readonly() satisfies z.ZodType<components['schemas']['BadgeEarned']>

export type BadgeEarned = z.infer<typeof badgeEarnedSchema>

export const kidReportSchema = z
  .object({
    profile_id: z.number().int(),
    name: z.string(),
    avatar: z.string(),
    age: z.number().int(),
    range_days: z.number().int(),
    today: z.string(),
    totals: periodTotalsSchema,
    previous: periodTotalsSchema,
    day_streak: z.number().int(),
    longest_streak: z.number().int(),
    last_played_at: z.string().nullable(),
    daily: z.array(dayPointSchema).readonly(),
    when: z.array(hourCellSchema).readonly(),
    games: z.array(gameStatSchema).readonly(),
    skills: z.array(skillStatSchema).readonly(),
    fact_cells: z.array(factCellSchema).readonly(),
    trouble_spots: z.array(troubleSpotSchema).readonly(),
    weekly: z.array(weekPointSchema).readonly(),
    insights: z.array(insightSchema).readonly(),
    badges: z.array(badgeEarnedSchema).readonly(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['KidReport']>

export type KidReport = z.infer<typeof kidReportSchema>

export const kidSummarySchema = z
  .object({
    profile_id: z.number().int(),
    name: z.string(),
    avatar: z.string(),
    age: z.number().int(),
    last_played_at: z.string().nullable(),
    minutes_7d: z.number().int(),
    active_days_7d: z.number().int(),
    problems_7d: z.number().int(),
    first_try_pct_7d: pct,
    day_streak: z.number().int(),
    daily_minutes_7d: z.array(z.number().int()).readonly(),
    attention_count: z.number().int(),
    headline: insightSchema.nullable(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['KidSummary']>

export const kidSummaryListSchema = z.array(kidSummarySchema).readonly()

export type KidSummary = z.infer<typeof kidSummarySchema>
