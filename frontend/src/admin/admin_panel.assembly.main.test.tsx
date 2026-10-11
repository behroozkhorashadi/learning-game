import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleAdminPanel } from './admin_panel.assembly.main.ts'

/** The real graph: assembled panel → admin + profiles adapters → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function respond(status: number, body: unknown = null): Promise<Response> {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

describe('assembleAdminPanel', () => {
  it('logs in, then lists players from GET /api/profiles', async () => {
    const fetchFake = vi.fn((url: string) => (url === '/api/admin/login' ? respond(204) : respond(200, [{ id: 5, name: 'Ada', avatar: 'cat', birth_year: 2017 }])))
    vi.stubGlobal('fetch', fetchFake)
    const AdminPanel = assembleAdminPanel()
    render(<AdminPanel onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Admin password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
    expect(await screen.findByText('Ada')).toBeTruthy()
    expect(fetchFake).toHaveBeenCalledWith('/api/admin/login', expect.objectContaining({ method: 'POST', body: JSON.stringify({ password: 'pw' }) }))
  })

  it('refuses a wrong password on a 401', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(401, { detail: 'Wrong admin password' })))
    const AdminPanel = assembleAdminPanel()
    render(<AdminPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Incorrect password.')
  })
})
