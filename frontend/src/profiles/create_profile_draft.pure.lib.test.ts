import { describe, expect, it } from 'vitest'
import { profileCreateFrom, type CreateProfileDraft } from './create_profile_draft.pure.lib.ts'
import { EMPTY_PASSWORD_DRAFT } from './profile_password.pure.lib.ts'

const COMPLETE: CreateProfileDraft = {
  name: ' Nora ',
  birthday: '2019-05-12',
  avatar: 'cat',
  photo: null,
  newPhotos: [],
  readingSupport: true,
  password: EMPTY_PASSWORD_DRAFT,
}

describe('profileCreateFrom', () => {
  it('builds the POST body from a complete draft', () => {
    expect(profileCreateFrom(COMPLETE, 2026)).toEqual({ name: 'Nora', avatar: 'cat', birth_year: 2019, reading_support: true, new_photos: [], password: null })
  })

  it.each<[string, Partial<CreateProfileDraft>]>([
    ['a blank name', { name: '  ' }],
    ['no birthday', { birthday: '' }],
    ['an out-of-range age', { birthday: '1900-01-01' }],
    ['neither an avatar nor a photo', { avatar: null }],
    ['an invalid password', { password: { password: 'abc', confirm: 'abc', remove: false } }],
  ])('is null with %s', (_, change) => {
    expect(profileCreateFrom({ ...COMPLETE, ...change }, 2026)).toBeNull()
  })

  it('uses a photo as the avatar when there is no animal, and sends the password', () => {
    const body = profileCreateFrom(
      { ...COMPLETE, avatar: null, photo: 'data:p', newPhotos: [{ src: 'data:p', label: 'Photo' }], password: { password: 'tiger', confirm: 'tiger', remove: false } },
      2026,
    )
    expect(body).toMatchObject({ avatar: 'fox', password: 'tiger', new_photos: [{ image_data_url: 'data:p', label: 'Photo', use_as_avatar: true }] })
  })
})
