import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfileRecord } from '@app/api/profiles_schema.pure.lib.ts'
import type { ProfileCreateBody } from './create_profile_draft.pure.lib.ts'
import { bindCreateProfile } from './create_profile.effect.ui.tsx'
import { bindProfilePhotoCapture } from './profile_photo_capture.effect.ui.tsx'
import { PHOTO, fakeCamera, fakeRemix } from './profile_photo_fixtures.test.lib.ts'

afterEach(cleanup)

const TODAY = '2026-10-10'
const NORA: ProfileRecord = { id: 3, name: 'Nora', avatar: 'cat', birth_year: 2019, reading_support: false, has_password: false, created_at: null }

/** A create capability that records each body and settles the way the test says. */
function fakeCreate(outcome: { readonly resolve: ProfileRecord } | { readonly reject: string } | 'pending' = { resolve: NORA }) {
  const bodies: ProfileCreateBody[] = []
  const createProfile = (body: ProfileCreateBody): Promise<ProfileRecord> => {
    bodies.push(body)
    if (outcome === 'pending') return new Promise(() => undefined)
    return 'resolve' in outcome ? Promise.resolve(outcome.resolve) : Promise.reject(new Error(outcome.reject))
  }
  return { bodies, createProfile }
}

function renderScreen(create = fakeCreate()) {
  const PhotoCapture = bindProfilePhotoCapture({ camera: fakeCamera(), remixPhoto: fakeRemix().remixPhoto })
  const CreateProfile = bindCreateProfile({ createProfile: create.createProfile, PhotoCapture, today: () => TODAY })
  const onCreated = vi.fn<(profile: ProfileRecord, password: string | null) => void>()
  const onCancel = vi.fn<() => void>()
  render(<CreateProfile onCreated={onCreated} onCancel={onCancel} />)
  return { ...create, onCreated, onCancel }
}

const submit = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))
}

function fillValidForm(): void {
  fireEvent.change(screen.getByPlaceholderText('What should we call them?'), { target: { value: '  Nora ' } })
  fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '2019-05-12' } })
  fireEvent.click(screen.getByRole('button', { name: 'Choose the cat avatar' }))
}

describe('CreateProfile', () => {
  it('does nothing on submit until name, birthday, and avatar are all set', () => {
    const { bodies } = renderScreen()

    submit()
    fireEvent.change(screen.getByPlaceholderText('What should we call them?'), { target: { value: 'Nora' } })
    submit()
    fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '2019-05-12' } })
    submit() // still no avatar
    expect(bodies).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Choose the cat avatar' }))
    submit()
    expect(bodies).toHaveLength(1)
  })

  it('rejects a birthday that puts the player outside the supported age range', () => {
    const { bodies } = renderScreen()
    fireEvent.change(screen.getByPlaceholderText('What should we call them?'), { target: { value: 'Nora' } })
    fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '1926-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Choose the cat avatar' }))

    expect(screen.getByText('Please enter a valid birthday.')).toBeTruthy()
    submit()
    expect(bodies).toHaveLength(0)
  })

  it('submits the trimmed payload and reports the created profile', async () => {
    const { bodies, onCreated } = renderScreen()
    fillValidForm()
    expect(screen.getByText('That makes them 7 years old.')).toBeTruthy()
    submit()

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeTruthy()
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(NORA, null)
    })
    expect(bodies).toEqual([{ name: 'Nora', avatar: 'cat', birth_year: 2019, reading_support: false, new_photos: [], password: null }])
  })

  it('turns reading support on for a young player until the parent overrides it', () => {
    renderScreen()
    const checkbox = screen.getByRole('checkbox', { name: /Extra reading help/ })
    // The label grows an age hint once a birthday is set, so hold on to the input.
    const birthday = screen.getByLabelText('Birthday')
    fireEvent.change(birthday, { target: { value: '2021-03-01' } })
    expect(checkbox).toHaveProperty('checked', true)
    fireEvent.change(birthday, { target: { value: '2015-03-01' } })
    expect(checkbox).toHaveProperty('checked', false)

    fireEvent.click(checkbox)
    fireEvent.change(birthday, { target: { value: '2015-04-01' } })
    expect(checkbox).toHaveProperty('checked', true)
  })

  it('shows the server error, keeps the form, and does not call onCreated when the request fails', async () => {
    const { onCreated } = renderScreen(fakeCreate({ reject: 'name must not be blank' }))
    fillValidForm()
    submit()

    expect((await screen.findByRole('alert')).textContent).toBe('name must not be blank')
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Create profile' })).toBeTruthy()
  })

  it('does not submit twice while the first request is pending', () => {
    const { bodies } = renderScreen(fakeCreate('pending'))
    fillValidForm()
    submit()
    fireEvent.click(screen.getByRole('button', { name: 'Creating…' }))
    expect(bodies).toHaveLength(1)
  })

  it('calls onCancel when Cancel is clicked', () => {
    const { onCancel } = renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('sends the password and hands it to onCreated once both boxes match', async () => {
    const { bodies, onCreated } = renderScreen()
    fillValidForm()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('Type the password again'), { target: { value: 'abc' } })
    expect(screen.getByText('Use at least 4 characters.')).toBeTruthy()
    submit()
    expect(bodies).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'tiger42' } })
    fireEvent.change(screen.getByLabelText('Type the password again'), { target: { value: 'tiger42' } })
    submit()

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(NORA, 'tiger42')
    })
    expect(bodies[0]?.password).toBe('tiger42')
  })

  it('creates with a photo instead of an animal, sending the photo as the avatar', async () => {
    const { bodies } = renderScreen()
    fireEvent.change(screen.getByPlaceholderText('What should we call them?'), { target: { value: 'Nora' } })
    fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '2019-05-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open camera' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take photo' }))
    submit()

    await waitFor(() => {
      expect(bodies).toHaveLength(1)
    })
    expect(bodies[0]?.new_photos).toEqual([{ image_data_url: PHOTO, label: 'Photo', use_as_avatar: true }])
  })

  it('picking an animal after a photo drops the photo from the avatar', async () => {
    const { bodies } = renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Open camera' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take photo' }))
    fillValidForm()
    submit()

    await waitFor(() => {
      expect(bodies).toHaveLength(1)
    })
    expect(bodies[0]).toMatchObject({ avatar: 'cat', new_photos: [{ image_data_url: PHOTO, use_as_avatar: false }] })
  })
})
