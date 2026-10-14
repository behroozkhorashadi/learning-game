import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindParentLogin } from './parent_login.effect.ui.tsx'
import { MOM } from './parents_fixtures.test.lib.ts'

afterEach(cleanup)

function renderLogin(unlock: (id: number, password: string) => Promise<'unlocked' | 'wrong-password'>) {
  const Login = bindParentLogin({ unlockParent: unlock })
  const onSignedIn = vi.fn()
  const onCancel = vi.fn()
  render(<Login parent={MOM} onSignedIn={onSignedIn} onCancel={onCancel} />)
  return { onSignedIn, onCancel }
}

const type = (value: string): void => {
  fireEvent.change(screen.getByLabelText('Password'), { target: { value } })
}

describe('ParentLogin', () => {
  it('signs in with the right password and hands it back', async () => {
    const unlock = vi.fn((_id: number, password: string) => Promise.resolve(password === 'secret' ? ('unlocked' as const) : ('wrong-password' as const)))
    const { onSignedIn } = renderLogin(unlock)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(unlock).not.toHaveBeenCalled()
    type('nope')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect((await screen.findByRole('alert')).textContent).toBe('That password didn’t work.')
    expect(screen.getByLabelText('Password')).toHaveProperty('value', '')
    type('secret')
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter' })
    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledWith('secret')
    })
    expect(unlock).toHaveBeenCalledWith(1, 'secret')
  })

  it('shows a failure and cancels', async () => {
    const { onCancel } = renderLogin(() => Promise.reject(new Error('HTTP 500')))
    type('x')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect((await screen.findByRole('alert')).textContent).toBe('HTTP 500')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
