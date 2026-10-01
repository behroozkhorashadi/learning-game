import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { EditProfile } from './EditProfile'
import type { Profile } from '../types/generated'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PHOTO_PROFILE: Profile = {
  id: 4,
  name: 'Nora',
  avatar: '/static/profile-avatars/abc.jpg',
  birth_year: 2019,
  reading_support: false,
  has_password: false,
}
const PROTECTED: Profile = { ...PHOTO_PROFILE, avatar: 'owl', has_password: true }

function mockPatch() {
  global.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    return Promise.resolve({ ok: true, json: async () => ({ ...PHOTO_PROFILE, ...body }) } as Response)
  }) as unknown as typeof fetch
}

function patchCall() {
  const [url, init] = vi.mocked(global.fetch).mock.calls[0]
  return { url, headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) }
}

describe('EditProfile', () => {
  it('keeps the saved photo on rename and sends the caller-supplied auth header', async () => {
    mockPatch()
    const onSaved = vi.fn()
    render(<EditProfile profile={PHOTO_PROFILE} authHeaders={{ 'X-Admin-Password': 'secret' }} onSaved={onSaved} onCancel={vi.fn()} />)

    expect(screen.getByAltText('Your profile picture preview').getAttribute('src')).toBe(PHOTO_PROFILE.avatar)
    fireEvent.change(screen.getByDisplayValue('Nora'), { target: { value: 'Nora B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nora B' }), undefined))
    const { url, headers, body } = patchCall()
    expect(url).toBe('/api/profiles/4')
    expect(headers['X-Admin-Password']).toBe('secret')
    expect(body).toEqual({ name: 'Nora B', birth_year: 2019, reading_support: false, avatar: PHOTO_PROFILE.avatar })
  })

  it('switches a photo profile to an animal avatar', async () => {
    mockPatch()
    const onSaved = vi.fn()
    render(<EditProfile profile={PHOTO_PROFILE} authHeaders={{}} onSaved={onSaved} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Choose the panda avatar' }))
    expect(screen.queryByAltText('Your profile picture preview')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(patchCall().body.avatar).toBe('panda')
  })

  it('adds a password only once both boxes match', async () => {
    mockPatch()
    const onSaved = vi.fn()
    render(<EditProfile profile={PHOTO_PROFILE} authHeaders={{}} onSaved={onSaved} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'tiger42' } })
    fireEvent.change(screen.getByLabelText('Type the password again'), { target: { value: 'tiger4' } })
    expect(screen.getByText(/don't match/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(global.fetch).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Type the password again'), { target: { value: 'tiger42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.anything(), 'tiger42'))
    expect(patchCall().body.password).toBe('tiger42')
  })

  it('removes the password of a protected profile', async () => {
    mockPatch()
    const onSaved = vi.fn()
    render(<EditProfile profile={PROTECTED} authHeaders={{ 'X-Profile-Password': 'tiger42' }} onSaved={onSaved} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByLabelText(/Remove the password/))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.anything(), null))
    const { headers, body } = patchCall()
    expect(headers['X-Profile-Password']).toBe('tiger42')
    expect(body.remove_password).toBe(true)
    expect(body.password).toBeUndefined()
  })
})
