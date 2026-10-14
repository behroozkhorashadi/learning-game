import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleCreateProfile } from './create_profile.assembly.main.ts'

/** The real graph: assembled screen → profiles adapter → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function respond(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

function fillAndSubmit(): void {
  fireEvent.change(screen.getByPlaceholderText('What should we call them?'), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '2017-02-03' } })
  fireEvent.click(screen.getByRole('button', { name: 'Choose the cat avatar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))
}

describe('assembleCreateProfile', () => {
  it('POSTs the new profile to /api/profiles and hands back the parsed result', async () => {
    const fetchFake = vi.fn((url: string) => (url === '/api/parents' ? respond(200, []) : respond(201, { id: 9, name: 'Ada', avatar: 'cat', birth_year: 2017 })))
    vi.stubGlobal('fetch', fetchFake)
    const CreateProfile = assembleCreateProfile()
    const onCreated = vi.fn()
    render(<CreateProfile onCreated={onCreated} onCancel={vi.fn()} onAddParent={vi.fn()} />)
    fillAndSubmit()

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 9, name: 'Ada', has_password: false }), null)
    })
    expect(fetchFake).toHaveBeenCalledWith('/api/profiles', expect.objectContaining({ method: 'POST' }))
  })

  it("shows the server's detail when the create is rejected", async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (url === '/api/parents' ? respond(200, []) : respond(422, { detail: 'That name is taken' }))))
    const CreateProfile = assembleCreateProfile()
    render(<CreateProfile onCreated={vi.fn()} onCancel={vi.fn()} onAddParent={vi.fn()} />)
    fillAndSubmit()
    expect((await screen.findByRole('alert')).textContent).toBe('That name is taken')
  })
})
