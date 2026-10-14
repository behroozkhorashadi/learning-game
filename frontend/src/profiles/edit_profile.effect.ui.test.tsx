import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfileAuth, ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import { PARENTS } from '@app/parents/parents_fixtures.test.lib.ts'
import { bindEditProfile } from './edit_profile.effect.ui.tsx'
import { bindProfilePhotoCapture } from './profile_photo_capture.effect.ui.tsx'
import { fakeCamera, fakeRemix } from './profile_photo_fixtures.test.lib.ts'
import type { SavedPhoto } from './profile_photo_state.pure.lib.ts'
import { fakeProfilesServer, type FakeProfilesOptions } from './profiles_api_fake.test.lib.ts'

afterEach(cleanup)

const PHOTO_PROFILE: ProfileRecord = { id: 4, name: 'Nora', avatar: '/static/profile-avatars/abc.jpg', birth_year: 2019, reading_support: false, has_password: false, created_at: null, parent_id: null }
const PROTECTED: ProfileRecord = { ...PHOTO_PROFILE, avatar: 'owl', has_password: true }
const SAVED: readonly SavedPhoto[] = [
  { id: 1, url: PHOTO_PROFILE.avatar, label: 'Photo', created_at: '2026-10-01T00:00:00' },
  { id: 2, url: '/static/profile-avatars/wizard.jpg', label: 'Wizard', created_at: '2026-10-01T00:00:00' },
]

function renderEdit(profile: ProfileRecord, auth: ProfileAuth = { kind: 'none' }, options: Partial<FakeProfilesOptions> = {}) {
  const server = fakeProfilesServer({ profiles: [profile], photos: SAVED, ...options })
  const EditProfile = bindEditProfile({
    updateProfile: server.update,
    listPhotos: server.listPhotos,
    deletePhoto: server.deletePhoto,
    PhotoCapture: bindProfilePhotoCapture({ camera: fakeCamera(), remixPhoto: fakeRemix().remixPhoto }),
    today: () => '2026-10-10',
    listParents: () => Promise.resolve(PARENTS),
  })
  const onSaved = vi.fn<(profile: ProfileRecord, password: string | null | undefined) => void>()
  render(<EditProfile profile={profile} auth={auth} onSaved={onSaved} onCancel={vi.fn()} />)
  const updates = () => server.calls.filter((c) => c.op === 'update')
  return { server, onSaved, updates }
}

const save = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
}

describe('EditProfile', () => {
  it('keeps the saved photo on rename and acts with the caller-supplied auth', async () => {
    const auth: ProfileAuth = { kind: 'admin', password: 'secret' }
    const { onSaved, updates } = renderEdit(PHOTO_PROFILE, auth)

    expect(screen.getByAltText('Your profile picture preview').getAttribute('src')).toBe(PHOTO_PROFILE.avatar)
    fireEvent.change(screen.getByDisplayValue('Nora'), { target: { value: 'Nora B' } })
    save()

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nora B' }), undefined)
    })
    expect(updates()).toEqual([
      { op: 'update', id: 4, auth, body: { name: 'Nora B', birth_year: 2019, reading_support: false, avatar: PHOTO_PROFILE.avatar, new_photos: [], remove_password: false, remove_parent: true } },
    ])
  })

  it('switches a photo profile to an animal avatar', async () => {
    const { onSaved, updates } = renderEdit(PHOTO_PROFILE)
    fireEvent.click(screen.getByRole('button', { name: 'Choose the panda avatar' }))
    expect(screen.queryByAltText('Your profile picture preview')).toBeNull()
    save()
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
    expect(updates()[0]?.body?.avatar).toBe('panda')
  })

  it('adds a password only once both boxes match', async () => {
    const { onSaved, updates } = renderEdit(PHOTO_PROFILE)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'tiger42' } })
    fireEvent.change(screen.getByLabelText('Type the password again'), { target: { value: 'tiger4' } })
    expect(screen.getByText("The two passwords don't match yet.")).toBeTruthy()
    save()
    expect(updates()).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Type the password again'), { target: { value: 'tiger42' } })
    save()
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.anything(), 'tiger42')
    })
    expect(updates()[0]?.body?.password).toBe('tiger42')
  })

  it('removes the password of a protected profile', async () => {
    const auth: ProfileAuth = { kind: 'profile', password: 'tiger42' }
    const { onSaved, updates } = renderEdit(PROTECTED, auth)
    fireEvent.click(screen.getByLabelText(/Remove the password/))
    save()
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ has_password: false }), null)
    })
    expect(updates()[0]).toMatchObject({ auth, body: { remove_password: true } })
    expect(updates()[0]?.body).not.toHaveProperty('password')
  })

  it('loads saved pictures with the auth and switches back to an earlier one', async () => {
    const auth: ProfileAuth = { kind: 'profile', password: 'tiger42' }
    const { server, onSaved, updates } = renderEdit(PHOTO_PROFILE, auth)
    fireEvent.click(await screen.findByRole('button', { name: 'Use Wizard' }))
    expect(server.calls[0]).toEqual({ op: 'listPhotos', id: 4, auth })
    save()
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
    expect(updates()[0]?.body?.avatar).toBe(SAVED[1]?.url)
  })

  it('deletes a saved picture after confirming, but offers no delete for the current one', async () => {
    const { server } = renderEdit(PHOTO_PROFILE)
    await screen.findByRole('button', { name: 'Use Wizard' })
    expect(screen.queryByRole('button', { name: 'Delete Photo' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Wizard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Really delete Wizard?' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Use Wizard' })).toBeNull()
    })
    expect(server.photos().map((p) => p.id)).toEqual([1])
  })

  it('shows why a save failed and keeps the edits', async () => {
    const { onSaved } = renderEdit(PHOTO_PROFILE, { kind: 'none' }, { fail: { op: 'update', message: 'Wrong password' } })
    fireEvent.change(screen.getByDisplayValue('Nora'), { target: { value: 'Nora B' } })
    save()
    expect((await screen.findByRole('alert')).textContent).toBe('Wrong password')
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Nora B')).toBeTruthy()
  })

  it('cannot save without a name', () => {
    const { updates } = renderEdit(PHOTO_PROFILE)
    fireEvent.change(screen.getByDisplayValue('Nora'), { target: { value: '  ' } })
    save()
    expect(updates()).toHaveLength(0)
  })

  it('moves the kid to another parent, or unlinks them', async () => {
    const { updates } = renderEdit({ ...PHOTO_PROFILE, parent_id: 1 })
    const select = await screen.findByRole('combobox', { name: /Parent/ })
    await screen.findByRole('option', { name: 'Dad' })
    fireEvent.change(select, { target: { value: '2' } })
    save()
    await waitFor(() => {
      expect(updates()).toHaveLength(1)
    })
    expect(updates()[0]).toMatchObject({ body: { parent_id: 2, remove_parent: false } })
  })
})
