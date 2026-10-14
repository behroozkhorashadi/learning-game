import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleParentLogin } from './parent_login.assembly.main.ts'
import { MOM } from './parents_fixtures.test.lib.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('assembleParentLogin', () => {
  it('POSTs the password to the unlock endpoint and treats 401 as a wrong password', async () => {
    const fetchFake = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(null, { status: 401 })))
    vi.stubGlobal('fetch', fetchFake)
    const Login = assembleParentLogin()
    render(<Login parent={MOM} onSignedIn={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect((await screen.findByRole('alert')).textContent).toBe('That password didn’t work.')
    expect(fetchFake).toHaveBeenCalledWith('/api/parents/1/unlock', expect.objectContaining({ method: 'POST', body: JSON.stringify({ password: 'nope' }) }))
  })
})
