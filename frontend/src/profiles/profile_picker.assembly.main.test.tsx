import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleProfilePicker } from './profile_picker.assembly.main.ts'

/** The real graph: assembled picker → profiles adapter → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const callbacks = { onSelect: vi.fn(), onAddPlayer: vi.fn(), onEditProfile: vi.fn(), onOpenAdmin: vi.fn() }

function respond(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

describe('assembleProfilePicker', () => {
  it('lists profiles from GET /api/profiles, filling server defaults', async () => {
    const fetchFake = vi.fn(() => respond(200, [{ id: 7, name: 'Ada', avatar: 'cat', birth_year: 2017 }]))
    vi.stubGlobal('fetch', fetchFake)
    const ProfilePicker = assembleProfilePicker()
    render(<ProfilePicker {...callbacks} />)
    expect(await screen.findByRole('button', { name: 'Play as Ada' })).toBeTruthy()
    expect(fetchFake).toHaveBeenCalledWith('/api/profiles', expect.objectContaining({ method: 'GET' }))
  })

  it('shows a parse failure instead of rendering a malformed profile', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(200, [{ name: 'No id', avatar: 'cat', birth_year: 2017 }])))
    const ProfilePicker = assembleProfilePicker()
    render(<ProfilePicker {...callbacks} />)
    expect(await screen.findByText(/returned an unexpected body/)).toBeTruthy()
  })
})
