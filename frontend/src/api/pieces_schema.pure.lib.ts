import { z } from 'zod'
import type { components } from './openapi_schema.pure.lib.ts'

/** A saved piece of writing. Stricter than the OpenAPI type: `id` is required (a returned piece is a stored row). */
export const pieceSchema = z
  .object({
    id: z.string(),
    profile_id: z.number().int(),
    game_id: z.string(),
    session_id: z.string().nullable().default(null),
    title: z.string().nullable().default(null),
    body: z.string(),
    constraints: z.array(z.string()).readonly().default([]),
    art_style: z.string().nullable().default(null),
    word_count: z.number(),
    created_at: z.string().default(''),
    revised_at: z.string().nullable().default(null),
  })
  .readonly() satisfies z.ZodType<components['schemas']['Piece']>

export const pieceListSchema = z.array(pieceSchema).readonly()

export const illustrationSchema = z
  .object({
    id: z.number().int().nullable().default(null),
    piece_id: z.string(),
    image_url: z.string(),
    prompt_excerpt: z.string(),
    order: z.number(),
    is_hero: z.boolean(),
    created_at: z.string().default(''),
  })
  .readonly() satisfies z.ZodType<components['schemas']['Illustration']>

export const illustrationListSchema = z.array(illustrationSchema).readonly()

export const gameSchema = z
  .object({ id: z.string(), title: z.string(), tagline: z.string(), icon: z.string(), min_age: z.number(), max_age: z.number(), max_level: z.number(), skill_ids: z.array(z.string()).readonly() })
  .readonly() satisfies z.ZodType<components['schemas']['GameMetadata']>

export const gameListSchema = z.array(gameSchema).readonly()

export type PieceRecord = z.infer<typeof pieceSchema>
export type IllustrationRecord = z.infer<typeof illustrationSchema>
export type GameRecord = z.infer<typeof gameSchema>
export type PieceBody = components['schemas']['PieceCreate']
export type RevisionBody = components['schemas']['RevisionPassCreate']
export type RemixBody = components['schemas']['RemixVersionCreate']
export type TurnBody = components['schemas']['TurnLineCreate']
export type IllustrationRequest = components['schemas']['IllustrationGenerateRequest']
