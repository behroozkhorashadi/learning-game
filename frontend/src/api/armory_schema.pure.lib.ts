import { z } from 'zod'
import type { components } from './openapi_schema.pure.lib.ts'

/** The armory's wire shapes (`/api/profiles/{id}/armory`), parsed at the door by armory_api.effect.lib.ts. */

export const armoryItemSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['weapon', 'bullet', 'grenade', 'art']),
    name: z.string(),
    description: z.string(),
    price: z.number().int(),
    quantity: z.number().int(),
    consumable: z.boolean(),
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
    ammo: z.record(z.string(), z.number().int()).readonly(),
    catalog: z.array(armoryItemSchema).readonly(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['ArmoryState']>

export type ArmoryItemRecord = z.infer<typeof armoryItemSchema>
export type ArmoryStateRecord = z.infer<typeof armoryStateSchema>

export const ART_STYLES = ['zombie_slayer', 'comic_hero', 'pixel_hero', 'space_ranger'] as const

export const artPieceSchema = z
  .object({
    id: z.string(),
    profile_id: z.number().int(),
    image_url: z.string(),
    style: z.enum(ART_STYLES),
    idea: z.string(),
    created_at: z.string(),
  })
  .readonly() satisfies z.ZodType<components['schemas']['ArtPiece']>

export const artResultSchema = z.object({ piece: artPieceSchema, armory: armoryStateSchema }).readonly() satisfies z.ZodType<components['schemas']['ArtResult']>

export type ArtStyle = (typeof ART_STYLES)[number]
export type ArtPieceRecord = z.infer<typeof artPieceSchema>
export type ArtResultRecord = z.infer<typeof artResultSchema>
