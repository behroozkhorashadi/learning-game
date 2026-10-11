import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOCKED } from './profile_fixtures.test.lib.ts'
import { assembleProfileUnlock } from './profile_unlock.assembly.main.ts'

/** The real graph: assembled prompt → profiles adapter → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('assembleProfileUnlock', () => {
  it('POSTs the password to the profile unlock endpoint', async () => {
    const fetchFake = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal('fetch', fetchFake)
    const ProfileUnlock = assembleProfileUnlock()
    const onUnlocked = vi.fn()
    render(<ProfileUnlock profile={LOCKED} onUnlocked={onUnlocked} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'tiger42' } })
    fireEvent.click(screen.getByRole('button', { name: "Let's go" }))
    await waitFor(() => {
      expect(onUnlocked).toHaveBeenCalledWith('tiger42')
    })
    expect(fetchFake).toHaveBeenCalledWith('/api/profiles/3/unlock', expect.objectContaining({ method: 'POST', body: JSON.stringify({ password: 'tiger42' }) }))
  })
})
