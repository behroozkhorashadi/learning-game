import { describe, expect, it } from 'vitest'
import { isPhotoAvatar, passwordAfterSave, profileUpdateFrom, type EditProfileDraft } from './edit_profile_draft.pure.lib.ts'
import { EMPTY_PASSWORD_DRAFT } from './profile_password.pure.lib.ts'

const DRAFT: EditProfileDraft = { name: 'Nora', birthday: '2019-01-01', avatar: 'owl', photo: null, newPhotos: [], readingSupport: false, password: EMPTY_PASSWORD_DRAFT, parentId: null }

describe('profileUpdateFrom', () => {
  it('sends the animal as the avatar and leaves the password alone', () => {
    expect(profileUpdateFrom(DRAFT, 2026)).toEqual({ name: 'Nora', birth_year: 2019, reading_support: false, new_photos: [], remove_password: false, remove_parent: true, avatar: 'owl' })
  })

  it('sends a saved photo URL as the avatar, but not a new photo (the server takes that from new_photos)', () => {
    expect(profileUpdateFrom({ ...DRAFT, avatar: null, photo: '/static/a.jpg' }, 2026)?.avatar).toBe('/static/a.jpg')
    const body = profileUpdateFrom({ ...DRAFT, avatar: null, photo: 'data:new', newPhotos: [{ src: 'data:new', label: 'Photo' }] }, 2026)
    expect(body).not.toHaveProperty('avatar')
    expect(body?.new_photos).toEqual([{ image_data_url: 'data:new', label: 'Photo', use_as_avatar: true }])
  })

  it('sets, keeps, or removes the password', () => {
    expect(profileUpdateFrom({ ...DRAFT, password: { password: 'lion99', confirm: 'lion99', remove: false } }, 2026)?.password).toBe('lion99')
    expect(profileUpdateFrom({ ...DRAFT, password: { password: '', confirm: '', remove: true } }, 2026)).toMatchObject({ remove_password: true })
  })

  it('links to the chosen parent, or unlinks when none is chosen', () => {
    expect(profileUpdateFrom({ ...DRAFT, parentId: 3 }, 2026)).toMatchObject({ parent_id: 3, remove_parent: false })
    expect(profileUpdateFrom(DRAFT, 2026)).not.toHaveProperty('parent_id')
  })

  it('is null for an invalid draft', () => {
    expect(profileUpdateFrom({ ...DRAFT, name: ' ' }, 2026)).toBeNull()
    expect(profileUpdateFrom({ ...DRAFT, avatar: null }, 2026)).toBeNull()
    expect(profileUpdateFrom({ ...DRAFT, birthday: '2026-02-02' }, 2026)).toBeNull()
  })
})

describe('passwordAfterSave', () => {
  it('is the new password, null when removed, undefined when unchanged', () => {
    expect(passwordAfterSave({ password: 'lion99', confirm: 'lion99', remove: false })).toBe('lion99')
    expect(passwordAfterSave({ password: '', confirm: '', remove: true })).toBeNull()
    expect(passwordAfterSave(EMPTY_PASSWORD_DRAFT)).toBeUndefined()
  })
})

describe('isPhotoAvatar', () => {
  it('tells a saved photo URL from an animal key', () => {
    expect([isPhotoAvatar('/static/profile-avatars/a.jpg'), isPhotoAvatar('owl')]).toEqual([true, false])
  })
})
