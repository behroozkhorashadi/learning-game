import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleProfilePicker } from './profile_picker.assembly.main.ts'

/** The real graph: assembled picker → profiles adapter → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const callbacks = { onSelect: vi.fn(), onAddPlayer: vi.fn(), onEditProfile: vi.fn(), onOpenAdmin: vi.fn(), onSelectParent: vi.fn(), onAddParent: vi.fn() }

function respond(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

describe('assembleProfilePicker', () => {
  it('lists profiles from GET /api/profiles, filling server defaults', async () => {
    const fetchFake = vi.fn((url: string) => respond(200, url === '/api/parents' ? [{ id: 1, name: 'Mom', created_at: '2026-10-01T00:00:00' }] : [{ id: 7, name: 'Ada', avatar: 'cat', birth_year: 2017 }]))
    vi.stubGlobal('fetch', fetchFake)
    const ProfilePicker = assembleProfilePicker()
    render(<ProfilePicker {...callbacks} />)
    expect(await screen.findByRole('button', { name: 'Play as Ada' })).toBeTruthy()
    expect(fetchFake).toHaveBeenCalledWith('/api/profiles', expect.objectContaining({ method: 'GET' }))
    expect(await screen.findByRole('button', { name: 'Parent dashboard for Mom' })).toBeTruthy()
  })

  it('shows a parse failure instead of rendering a malformed profile', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(200, [{ name: 'No id', avatar: 'cat', birth_year: 2017 }])))
    const ProfilePicker = assembleProfilePicker()
    render(<ProfilePicker {...callbacks} />)
    expect(await screen.findByText(/returned an unexpected body/)).toBeTruthy()
  })
})
