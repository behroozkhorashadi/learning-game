import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOCKED } from './profile_fixtures.test.lib.ts'
import { bindProfileUnlock } from './profile_unlock.effect.ui.tsx'
import { fakeProfilesServer } from './profiles_api_fake.test.lib.ts'

afterEach(cleanup)

function renderUnlock(unlockProfile = fakeProfilesServer({ profiles: [LOCKED] }).unlock) {
  const ProfileUnlock = bindProfileUnlock({ unlockProfile })
  const onUnlocked = vi.fn<(password: string) => void>()
  const onCancel = vi.fn<() => void>()
  render(<ProfileUnlock profile={LOCKED} onUnlocked={onUnlocked} onCancel={onCancel} />)
  return { onUnlocked, onCancel }
}

function submit(password: string): void {
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: "Let's go" }))
}

describe('ProfileUnlock', () => {
  it('greets the player and hands back the password once the server accepts it', async () => {
    const { onUnlocked } = renderUnlock()
    expect(screen.getByRole('heading', { name: 'Hi Nora!' })).toBeTruthy()
    submit('tiger42')
    await waitFor(() => {
      expect(onUnlocked).toHaveBeenCalledWith('tiger42')
    })
  })

  it('says so and clears the box on a wrong password', async () => {
    const { onUnlocked } = renderUnlock()
    submit('nope')
    expect((await screen.findByRole('alert')).textContent).toBe("That's not it. Try again!")
    expect(onUnlocked).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Password')).toHaveProperty('value', '')
  })

  it('submits on Enter', async () => {
    const { onUnlocked } = renderUnlock()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'tiger42' } })
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter' })
    await waitFor(() => {
      expect(onUnlocked).toHaveBeenCalledWith('tiger42')
    })
  })

  it('does not send a blank password', () => {
    const unlock = vi.fn(() => Promise.resolve<'unlocked'>('unlocked'))
    renderUnlock(unlock)
    fireEvent.click(screen.getByRole('button', { name: "Let's go" }))
    expect(unlock).not.toHaveBeenCalled()
  })

  it('shows a server failure and lets the player try again', async () => {
    const { onUnlocked } = renderUnlock(() => Promise.reject(new Error('POST /api/profiles/3/unlock failed with HTTP 500')))
    submit('tiger42')
    expect((await screen.findByRole('alert')).textContent).toBe('POST /api/profiles/3/unlock failed with HTTP 500')
    expect(onUnlocked).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: "Let's go" })).toBeTruthy()
  })

  it('goes back on Back', () => {
    const { onCancel } = renderUnlock()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
