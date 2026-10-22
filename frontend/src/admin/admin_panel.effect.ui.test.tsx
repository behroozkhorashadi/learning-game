import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeProfilesServer } from '@app/profiles/profiles_api_fake.test.lib.ts'
import { ADMIN_PASSWORD, PLAYERS, fakeAdminPanel } from './admin_fixtures.test.ui.tsx'

afterEach(cleanup)

function login(password = ADMIN_PASSWORD): void {
  fireEvent.change(screen.getByLabelText('Admin password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
}

async function renderLoggedIn(server = fakeProfilesServer({ profiles: PLAYERS })) {
  const panel = fakeAdminPanel(server)
  const onClose = vi.fn<() => void>()
  render(<panel.AdminPanel onClose={onClose} />)
  login()
  await screen.findByText('Demo Kid')
  return { ...panel, onClose }
}

describe('AdminPanel login', () => {
  it('shows an error and never lists profiles on a wrong password', async () => {
    const { AdminPanel, server } = fakeAdminPanel()
    render(<AdminPanel onClose={vi.fn()} />)
    login('wrong')
    expect((await screen.findByRole('alert')).textContent).toBe('Incorrect password.')
    expect(server.calls).toEqual([])
  })

  it('lists profiles with their age and lock after a correct password', async () => {
    await renderLoggedIn()
    expect(screen.getByRole('heading', { name: 'Players' })).toBeTruthy()
    expect(screen.getByText('Age 6')).toBeTruthy()
    expect(screen.getByText(/Age 7 · 🔒 Has a password/)).toBeTruthy()
    expect(screen.getByText('zombie horde · gameplay')).toBeTruthy()
    expect(screen.getByText('6 min')).toBeTruthy()
  })

  it('submits on Enter, and Back closes the screen', async () => {
    const { AdminPanel, logins } = fakeAdminPanel()
    const onClose = vi.fn()
    render(<AdminPanel onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Admin password'), { target: { value: 'x' } })
    fireEvent.keyDown(screen.getByLabelText('Admin password'), { key: 'Enter' })
    await waitFor(() => {
      expect(logins).toEqual(['x'])
    })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a list failure', async () => {
    const { AdminPanel } = fakeAdminPanel(fakeProfilesServer({ profiles: PLAYERS, fail: { op: 'list', message: 'GET /api/profiles failed with HTTP 500' } }))
    render(<AdminPanel onClose={vi.fn()} />)
    login()
    expect((await screen.findByRole('alert')).textContent).toBe('GET /api/profiles failed with HTTP 500')
  })
})

describe('AdminPanel delete flow', () => {
  it('cancelling the confirmation deletes nothing', async () => {
    const { server } = await renderLoggedIn()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Demo Kid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Demo Kid')).toBeTruthy()
    expect(server.calls.map((c) => c.op)).toEqual(['list'])
  })

  it('confirming removes the player as admin and reloads the list', async () => {
    const { server } = await renderLoggedIn()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Demo Kid' }))
    expect(screen.getByText("Remove Demo Kid and all of their progress? This can't be undone.")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await waitFor(() => {
      expect(screen.queryByText('Demo Kid')).toBeNull()
    })
    expect(screen.getByText('Rami')).toBeTruthy()
    expect(server.calls.find((c) => c.op === 'remove')).toEqual({ op: 'remove', id: 1, auth: { kind: 'admin', password: ADMIN_PASSWORD } })
  })

  it('shows why a delete failed and keeps the row', async () => {
    await renderLoggedIn(fakeProfilesServer({ profiles: PLAYERS, fail: { op: 'remove', message: 'Not allowed' } }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Demo Kid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Not allowed')
    expect(screen.getByText('Demo Kid')).toBeTruthy()
  })
})

describe('AdminPanel edit flow', () => {
  it('prefills the form, saves as admin, and returns to the reloaded list', async () => {
    const { server } = await renderLoggedIn()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Demo Kid' }))
    fireEvent.change(await screen.findByDisplayValue('Demo Kid'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Renamed')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Players' })).toBeTruthy()
    expect(server.calls.find((c) => c.op === 'update')).toMatchObject({ id: 1, auth: { kind: 'admin', password: ADMIN_PASSWORD }, body: { name: 'Renamed' } })
  })

  it('cancelling an edit returns to the list', async () => {
    await renderLoggedIn()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Rami' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(await screen.findByRole('heading', { name: 'Players' })).toBeTruthy()
  })
})
