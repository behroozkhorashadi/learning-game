import type { components } from '@app/api/openapi_schema.pure.lib.ts'
import { ageFromBirthday, birthYearOf, isAgeInRange } from './profile_form.pure.lib.ts'
import { passwordDraftError, type PasswordDraft } from './profile_password.pure.lib.ts'
import { newPhotosPayload, type NewPhoto } from './profile_photo_state.pure.lib.ts'

export type ProfileUpdateBody = components['schemas']['ProfileUpdate']

/** A saved photo avatar is a server URL; an animal is a key like 'owl'. */
export function isPhotoAvatar(avatar: string): boolean {
  return avatar.startsWith('/static/')
}

/** Everything the edit form holds. */
export interface EditProfileDraft {
  readonly name: string
  readonly birthday: string
  readonly avatar: string | null
  /** A saved photo's URL, a new photo's data URL, or null for an animal. */
  readonly photo: string | null
  readonly newPhotos: readonly NewPhoto[]
  readonly readingSupport: boolean
  readonly password: PasswordDraft
  /** The linked parent, or null to unlink (a no-op when there was none). */
  readonly parentId: number | null
}

/**
 * The PATCH body for a valid draft, or null while it can't be saved. A photo
 * made this session isn't sent as `avatar`: the server sets it from the
 * `new_photos` entry marked `use_as_avatar`.
 */
export function profileUpdateFrom(draft: EditProfileDraft, currentYear: number): ProfileUpdateBody | null {
  const name = draft.name.trim()
  const age = ageFromBirthday(draft.birthday, currentYear)
  if (name === '' || age === null || !isAgeInRange(age)) return null
  if (draft.avatar === null && draft.photo === null) return null
  if (passwordDraftError(draft.password) !== null) return null
  const isNewPhoto = draft.newPhotos.some((p) => p.src === draft.photo)
  return {
    name,
    birth_year: birthYearOf(draft.birthday),
    reading_support: draft.readingSupport,
    new_photos: newPhotosPayload(draft.newPhotos, draft.photo),
    remove_password: draft.password.remove,
    remove_parent: draft.parentId === null,
    ...(draft.parentId === null ? {} : { parent_id: draft.parentId }),
    ...(isNewPhoto ? {} : { avatar: draft.photo ?? draft.avatar }),
    ...(!draft.password.remove && draft.password.password !== '' ? { password: draft.password.password } : {}),
  }
}

/** What the caller should now remember as the profile's password: the new one, null if removed, undefined if unchanged. */
export function passwordAfterSave(draft: PasswordDraft): string | null | undefined {
  if (draft.remove) return null
  return draft.password === '' ? undefined : draft.password
}
