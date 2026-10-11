import { z } from 'zod'
import type { components } from './openapi_schema.pure.lib.ts'

/** The armory's wire shapes (`/api/profiles/{id}/armory`), parsed at the door by armory_api.effect.lib.ts. */

export const armoryItemSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['weapon', 'bullet', 'grenade']),
    name: z.string(),
    description: z.string(),
    price: z.number().int(),
    quantity: z.number().int(),
    requires: z.string().nullable(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['ArmoryItem']>

export const armoryStateSchema = z
  .object({
    profile_id: z.number().int(),
    balance: z.number().int(),
    earned: z.number().int(),
    spent: z.number().int(),
    owned: z.array(z.string()).readonly(),
    grenades: z.number().int(),
    catalog: z.array(armoryItemSchema).readonly(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['ArmoryState']>

export type ArmoryItemRecord = z.infer<typeof armoryItemSchema>
export type ArmoryStateRecord = z.infer<typeof armoryStateSchema>
