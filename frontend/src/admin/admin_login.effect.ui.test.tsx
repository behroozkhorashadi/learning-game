import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindAdminLogin } from './admin_login.effect.ui.tsx'

afterEach(cleanup)

describe('AdminLogin', () => {
  it('hands back an accepted password', async () => {
    const AdminLogin = bindAdminLogin({ login: () => Promise.resolve('ok') })
    const onAuthenticated = vi.fn()
    render(<AdminLogin onAuthenticated={onAuthenticated} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Admin password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledWith('secret')
    })
  })

  it('shows a server failure and stays on the form', async () => {
    const AdminLogin = bindAdminLogin({ login: () => Promise.reject(new Error('POST /api/admin/login failed with HTTP 503')) })
    const onAuthenticated = vi.fn()
    render(<AdminLogin onAuthenticated={onAuthenticated} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
    expect((await screen.findByRole('alert')).textContent).toBe('POST /api/admin/login failed with HTTP 503')
    expect(onAuthenticated).not.toHaveBeenCalled()
  })

  it('shows Checking… and ignores a second submit while the first is pending', () => {
    const login = vi.fn(() => new Promise<'ok'>(() => undefined))
    const AdminLogin = bindAdminLogin({ login })
    render(<AdminLogin onAuthenticated={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
    fireEvent.keyDown(screen.getByLabelText('Admin password'), { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeTruthy()
    expect(login).toHaveBeenCalledTimes(1)
  })
})
