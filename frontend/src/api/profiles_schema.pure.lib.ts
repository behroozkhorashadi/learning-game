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
    /** The parent this kid is linked to (`GET /api/parents`), if any. */
    parent_id: z.number().int().nullable().default(null),
  })
  .readonly() satisfies z.ZodType<components['schemas']['ProfileRead']>

export const profileListSchema = z.array(profileSchema).readonly()

export type ProfileRecord = z.infer<typeof profileSchema>

export const photoRemixResponseSchema = z
  .object({ image_data_url: z.string() })
  .readonly() satisfies z.ZodType<components['schemas']['ProfilePhotoRemixResponse']>

export const savedPhotoSchema = z
  .object({ id: z.number().int(), url: z.string(), label: z.string(), created_at: z.string() })
  .readonly() satisfies z.ZodType<components['schemas']['ProfilePhotoRead']>

export const savedPhotoListSchema = z.array(savedPhotoSchema).readonly()

/**
 * Who is acting on a profile. The adapter turns it into the header the
 * backend checks (backend/app/admin_auth.py, services/profile_passwords.py):
 * the profile's own password (or the admin password as an override) as
 * `X-Profile-Password`, the admin screen's as `X-Admin-Password`, or nothing
 * for an unprotected profile.
 */
export type ProfileAuth = { readonly kind: 'none' } | { readonly kind: 'profile'; readonly password: string } | { readonly kind: 'admin'; readonly password: string }

export const NO_AUTH: ProfileAuth = { kind: 'none' }
