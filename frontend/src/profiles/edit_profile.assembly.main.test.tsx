import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleEditProfile } from './edit_profile.assembly.main.ts'
import { LOCKED } from './profile_fixtures.test.lib.ts'

/** The real graph: assembled screen → profiles adapter → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function respond(body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
}

describe('assembleEditProfile', () => {
  it('loads photos and PATCHes the profile with the profile-password header', async () => {
    const fetchFake = vi.fn((url: string, _init?: RequestInit) => (url.endsWith('/photos') ? respond([]) : respond({ ...LOCKED, name: 'Nora B' })))
    vi.stubGlobal('fetch', fetchFake)
    const EditProfile = assembleEditProfile()
    const onSaved = vi.fn()
    render(<EditProfile profile={LOCKED} auth={{ kind: 'profile', password: 'tiger42' }} onSaved={onSaved} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('Nora'), { target: { value: 'Nora B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nora B' }), undefined)
    })
    const sent = fetchFake.mock.calls.map(([url, init]) => [url, init?.method, new Headers(init?.headers).get('X-Profile-Password')])
    expect(sent).toEqual([
      ['/api/profiles/3/photos', 'GET', 'tiger42'],
      ['/api/profiles/3', 'PATCH', 'tiger42'],
    ])
  })
})
