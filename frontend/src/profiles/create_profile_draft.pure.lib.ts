import type { components } from '@app/api/openapi_schema.pure.lib.ts'
import { ageFromBirthday, birthYearOf, isAgeInRange } from './profile_form.pure.lib.ts'
import { passwordDraftError, type PasswordDraft } from './profile_password.pure.lib.ts'
import { newPhotosPayload, type NewPhoto } from './profile_photo_state.pure.lib.ts'

export type ProfileCreateBody = components['schemas']['ProfileCreate']

/** Everything the create-profile form has collected so far. */
export interface CreateProfileDraft {
  readonly name: string
  /** `YYYY-MM-DD`, or '' while unset. Only the year is sent. */
  readonly birthday: string
  readonly avatar: string | null
  /** The picked photo (a data URL), or null for an animal avatar. */
  readonly photo: string | null
  readonly newPhotos: readonly NewPhoto[]
  readonly readingSupport: boolean
  readonly password: PasswordDraft
}

/**
 * The POST /api/profiles body for a complete draft, or null while it can't be
 * submitted: it needs a name, a birthday in the supported age range, an
 * avatar or a photo, and a valid (or blank) password.
 */
export function profileCreateFrom(draft: CreateProfileDraft, currentYear: number): ProfileCreateBody | null {
  const name = draft.name.trim()
  const age = ageFromBirthday(draft.birthday, currentYear)
  if (name === '' || age === null || !isAgeInRange(age)) return null
  if (draft.avatar === null && draft.photo === null) return null
  if (passwordDraftError(draft.password) !== null) return null
  return {
    name,
    // With a photo, the server sets the avatar from the photo marked use_as_avatar; 'fox' only fills the required field.
    avatar: draft.avatar ?? 'fox',
    birth_year: birthYearOf(draft.birthday),
    reading_support: draft.readingSupport,
    new_photos: newPhotosPayload(draft.newPhotos, draft.photo),
    password: draft.password.password === '' ? null : draft.password.password,
  }
}
