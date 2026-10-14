import { z } from 'zod'
import type { components } from './openapi_schema.pure.lib.ts'

/** The armory's wire shapes (`/api/profiles/{id}/armory`), parsed at the door by armory_api.effect.lib.ts. */

export const armoryItemSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['weapon', 'bullet', 'grenade', 'gem', 'upgrade', 'skin', 'art', 'style']),
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
    gems: z.record(z.string(), z.number().int()).readonly(),
    best_survived_ms: z.object({ easy: z.number().int(), medium: z.number().int(), hard: z.number().int(), insane: z.number().int() }).readonly(),
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

/** A profile's looks (`/api/profiles/{id}/armory/looks`): the skin worn, the paint, the emblem, and the art hung in the games. */

export const SUIT_SHINES = ['matte', 'shiny', 'glow'] as const
export const EMBLEM_SYMBOLS = ['star', 'bolt', 'heart', 'crown', 'flame', 'rocket', 'paw', 'smile', 'moon', 'rainbow', 'dino', 'zombie'] as const
export const EMBLEM_PLACES = ['arm', 'blaster', 'both'] as const

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/)

export const suitPaintSchema = z.object({ color: hexColor, shine: z.enum(SUIT_SHINES) }).readonly() satisfies z.ZodType<components['schemas']['SuitPaint']>

export const emblemSchema = z
  .object({
    symbol: z.enum(EMBLEM_SYMBOLS).nullable(),
    art_id: z.string().nullable(),
    color: hexColor,
    place: z.enum(EMBLEM_PLACES),
  })
  .readonly() satisfies z.ZodType<components['schemas']['Emblem']>

export const hungPicturesSchema = z.object({ pathfinder: z.string().nullable(), horde: z.string().nullable() }).readonly() satisfies z.ZodType<components['schemas']['HungPictures']>

export const armoryLooksSchema = z
  .object({
    skin_id: z.string().nullable(),
    suit_paint: suitPaintSchema.nullable(),
    blaster_color: hexColor.nullable(),
    emblem: emblemSchema.nullable(),
    hung: hungPicturesSchema,
  })
  .readonly() satisfies z.ZodType<components['schemas']['ArmoryLooks']>

export const armoryLooksStateSchema = z
  .object({ looks: armoryLooksSchema, pictures: z.record(z.string(), z.string()).readonly() })
  .readonly() satisfies z.ZodType<components['schemas']['ArmoryLooksState']>

export type SuitShine = (typeof SUIT_SHINES)[number]
export type EmblemSymbol = (typeof EMBLEM_SYMBOLS)[number]
export type EmblemPlace = (typeof EMBLEM_PLACES)[number]
export type SuitPaintRecord = z.infer<typeof suitPaintSchema>
export type EmblemRecord = z.infer<typeof emblemSchema>
export type HungPicturesRecord = z.infer<typeof hungPicturesSchema>
export type ArmoryLooksRecord = z.infer<typeof armoryLooksSchema>
export type ArmoryLooksStateRecord = z.infer<typeof armoryLooksStateSchema>

/** The URL of the art hung at `spot` (`pathfinder`, `horde`), or null when nothing is hung or the art is gone. */
export function hungPictureUrl(state: ArmoryLooksStateRecord, spot: keyof HungPicturesRecord): string | null {
  const artId = state.looks.hung[spot]
  return artId === null ? null : (state.pictures[artId] ?? null)
}
