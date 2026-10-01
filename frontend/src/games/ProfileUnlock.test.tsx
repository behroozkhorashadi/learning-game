import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ProfileUnlock } from './ProfileUnlock'
import type { Profile } from '../types/generated'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PROFILE: Profile = { id: 7, name: 'Nora', avatar: 'owl', birth_year: 2019, has_password: true }

function mockUnlock(status: number) {
  global.fetch = vi.fn(() => Promise.resolve({ ok: status < 300, status } as Response)) as unknown as typeof fetch
}

function submit(password: string) {
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: "Let's go" }))
}

describe('ProfileUnlock', () => {
  it('hands back the password once the server accepts it', async () => {
    mockUnlock(204)
    const onUnlocked = vi.fn()
    render(<ProfileUnlock profile={PROFILE} onUnlocked={onUnlocked} onCancel={vi.fn()} />)

    submit('tiger42')

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledWith('tiger42'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/profiles/7/unlock',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ password: 'tiger42' }) }),
    )
  })

  it('says so and clears the box on a wrong password', async () => {
    mockUnlock(401)
    const onUnlocked = vi.fn()
    render(<ProfileUnlock profile={PROFILE} onUnlocked={onUnlocked} onCancel={vi.fn()} />)

    submit('nope')

    await screen.findByText(/not it/)
    expect(onUnlocked).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
  })

  it('does not send a blank password', () => {
    mockUnlock(204)
    render(<ProfileUnlock profile={PROFILE} onUnlocked={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: "Let's go" }))

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
