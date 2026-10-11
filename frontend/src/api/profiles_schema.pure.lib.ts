import { z } from 'zod'
import type { components } from './openapi_schema.pure.lib.ts'

/**
 * A profile as the API returns it (`ProfileRead`). Pure, so UI can import the
 * type; the adapter that parses responses is profiles_api.effect.lib.ts.
 *
 * Stricter than the OpenAPI type on one point: `id` is required. Every
 * listed profile is a stored row, and the picker can't select one without it.
 */
export const profileSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    avatar: z.string(),
    birth_year: z.number().int(),
    reading_support: z.boolean().default(false),
    has_password: z.boolean().default(false),
    created_at: z.string().nullable().default(null),
  })
  .readonly() satisfies z.ZodType<components['schemas']['ProfileRead']>

export const profileListSchema = z.array(profileSchema).readonly()

export type ProfileRecord = z.infer<typeof profileSchema>

export const photoRemixResponseSchema = z
  .object({ image_data_url: z.string() })
  .readonly() satisfies z.ZodType<components['schemas']['ProfilePhotoRemixResponse']>
