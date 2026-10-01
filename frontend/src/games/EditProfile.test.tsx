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

const SAVED = [
  { id: 1, url: PHOTO_PROFILE.avatar, label: 'Photo', created_at: '2026-10-01T00:00:00' },
  { id: 2, url: '/static/profile-avatars/wizard.jpg', label: 'Wizard', created_at: '2026-10-01T00:00:00' },
]

function mockPatch() {
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/photos')) return Promise.resolve({ ok: true, json: async () => SAVED } as Response)
    if (init?.method === 'DELETE') return Promise.resolve({ ok: true, status: 204 } as Response)
    const body = JSON.parse(String(init?.body))
    return Promise.resolve({ ok: true, json: async () => ({ ...PHOTO_PROFILE, ...body }) } as Response)
  }) as unknown as typeof fetch
}

function callTo(method: string) {
  const call = vi.mocked(global.fetch).mock.calls.find(([, init]) => init?.method === method)
  return call && { url: call[0], headers: call[1]?.headers as Record<string, string>, body: call[1]?.body && JSON.parse(String(call[1].body)) }
}

function patchCall() {
  return callTo('PATCH')!
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
    expect(body).toEqual({ name: 'Nora B', birth_year: 2019, reading_support: false, avatar: PHOTO_PROFILE.avatar, new_photos: [] })
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
    expect(callTo('PATCH')).toBeUndefined()

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

  it('loads saved pictures with the auth header and switches back to an earlier one', async () => {
    mockPatch()
    const onSaved = vi.fn()
    render(<EditProfile profile={PHOTO_PROFILE} authHeaders={{ 'X-Profile-Password': 'tiger42' }} onSaved={onSaved} onCancel={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Use Wizard' }))
    expect(vi.mocked(global.fetch).mock.calls[0][1]?.headers).toEqual({ 'X-Profile-Password': 'tiger42' })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(patchCall().body.avatar).toBe(SAVED[1].url)
  })

  it('deletes a saved picture after confirming, but offers no delete for the current one', async () => {
    mockPatch()
    render(<EditProfile profile={PHOTO_PROFILE} authHeaders={{}} onSaved={vi.fn()} onCancel={vi.fn()} />)

    await screen.findByRole('button', { name: 'Use Wizard' })
    expect(screen.queryByRole('button', { name: 'Delete Photo' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Wizard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Really delete Wizard?' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Use Wizard' })).toBeNull())
    expect(callTo('DELETE')?.url).toBe('/api/profiles/4/photos/2')
  })
})
