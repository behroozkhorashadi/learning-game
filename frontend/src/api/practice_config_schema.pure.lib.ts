import { z } from 'zod'
import type { components } from './openapi_schema.pure.lib.ts'

/** A profile's per-game practice settings, as GET /api/practice-config returns them. The adapter is practice_config_api.effect.lib.ts. */
export const practiceConfigSchema = z
  .object({
    profile_id: z.number().int(),
    game_id: z.string(),
    operations: z.array(z.string()).readonly(),
    focus_numbers: z.record(z.string(), z.array(z.number()).readonly()).readonly().default({}),
    difficulty: z.number(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['PracticeConfig']>

export type PracticeConfigRecord = z.infer<typeof practiceConfigSchema>
export type PracticeConfigUpsert = components['schemas']['PracticeConfigUpsert']
