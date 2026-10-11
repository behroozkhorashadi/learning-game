import { z } from 'zod'
import type { components } from './openapi_schema.pure.lib.ts'

/** A practice item as `GET /api/items/next` serves it. `payload` is game-specific: each game parses its own. */
export const itemSchema = z
  .object({
    item_id: z.string(),
    game_id: z.string(),
    level: z.number(),
    payload: z.record(z.string(), z.unknown()).readonly(),
    variant_id: z.string().nullable().default(null),
  })
  .readonly() satisfies z.ZodType<components['schemas']['Item']>

/** What the server recorded for an attempt (`POST /api/attempts`). */
export const attemptSchema = z
  .object({
    id: z.number().int(),
    event_id: z.string(),
    correct: z.boolean().nullable(),
    score: z.number().nullable(),
    hints_used: z.number(),
    hint_offered: z.boolean(),
    time_ms: z.number(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['AttemptRead']>

export type ItemRecord = z.infer<typeof itemSchema>
export type AttemptRecord = z.infer<typeof attemptSchema>
export type AttemptBody = components['schemas']['AttemptCreate']
