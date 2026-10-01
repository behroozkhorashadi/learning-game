import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { EditProfile } from './EditProfile'
import type { Profile } from '../types/generated'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PHOTO_PROFILE: Profile = { id: 4, name: 'Nora', avatar: '/static/profile-avatars/abc.jpg', birth_year: 2019, reading_support: false }

function mockFetch(loginOk: boolean) {
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/admin/login') return Promise.resolve({ ok: loginOk, status: loginOk ? 204 : 401 } as Response)
    if (url === `/api/profiles/${PHOTO_PROFILE.id}`) {
      return Promise.resolve({ ok: true, json: async () => ({ ...PHOTO_PROFILE, ...JSON.parse(String(init?.body)) }) } as Response)
    }
    throw new Error(`unexpected fetch: ${url}`)
  }) as unknown as typeof fetch
}

function patchBody() {
  const call = vi.mocked(global.fetch).mock.calls.find(([url]) => url === `/api/profiles/${PHOTO_PROFILE.id}`)
  return JSON.parse(String(call?.[1]?.body))
}

describe('EditProfile', () => {
  it('skips the password prompt when no admin password is set and keeps the saved photo on rename', async () => {
    mockFetch(true)
    const onSaved = vi.fn()
    render(<EditProfile profile={PHOTO_PROFILE} onSaved={onSaved} onCancel={vi.fn()} />)

    const nameInput = await screen.findByDisplayValue('Nora')
    expect(screen.getByAltText('Your profile picture preview').getAttribute('src')).toBe(PHOTO_PROFILE.avatar)

    fireEvent.change(nameInput, { target: { value: 'Nora B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(patchBody()).toEqual({ name: 'Nora B', birth_year: 2019, reading_support: false, avatar: PHOTO_PROFILE.avatar })
  })

  it('switches a photo profile to an animal avatar', async () => {
    mockFetch(true)
    const onSaved = vi.fn()
    render(<EditProfile profile={PHOTO_PROFILE} onSaved={onSaved} onCancel={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Choose the panda avatar' }))
    expect(screen.queryByAltText('Your profile picture preview')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(patchBody().avatar).toBe('panda')
  })

  it('asks for the admin password when one is set', async () => {
    mockFetch(false)
    render(<EditProfile profile={PHOTO_PROFILE} onSaved={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByPlaceholderText('Password')).toBeTruthy()
    expect(screen.queryByDisplayValue('Nora')).toBeNull()
  })
})
