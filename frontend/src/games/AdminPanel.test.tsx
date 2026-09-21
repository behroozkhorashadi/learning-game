import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { AdminPanel } from './AdminPanel'
import type { Profile } from '../types/generated'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PROFILES: Profile[] = [
  { id: 1, name: 'Demo Kid', avatar: 'fox', birth_year: 2020, reading_support: false },
  { id: 2, name: 'Rami', avatar: 'rami', birth_year: 2019, reading_support: false },
]

function login(password = 'parentcode123') {
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
}

describe('AdminPanel login', () => {
  it('shows an error and never fetches profiles on a wrong password', async () => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/admin/login') return Promise.resolve({ ok: false, status: 401 } as Response)
      throw new Error(`unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    render(<AdminPanel onClose={vi.fn()} />)
    login('wrong')

    await screen.findByText(/incorrect password/i)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('lists profiles after a correct password', async () => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/admin/login') return Promise.resolve({ ok: true, status: 204 } as Response)
      if (url === '/api/profiles') return Promise.resolve({ ok: true, json: async () => PROFILES } as Response)
      throw new Error(`unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    render(<AdminPanel onClose={vi.fn()} />)
    login()

    expect(await screen.findByText('Demo Kid')).toBeTruthy()
    expect(screen.getByText('Age 6')).toBeTruthy()
    expect(screen.getByText('Rami')).toBeTruthy()
  })
})

describe('AdminPanel delete flow', () => {
  async function renderLoggedIn() {
    const profilesAfterDelete = [PROFILES[1]]
    let getCount = 0
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/admin/login') return Promise.resolve({ ok: true, status: 204 } as Response)
      if (url === '/api/profiles') {
        getCount += 1
        return Promise.resolve({ ok: true, json: async () => (getCount === 1 ? PROFILES : profilesAfterDelete) } as Response)
      }
      if (url === '/api/profiles/1' && init?.method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204 } as Response)
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    render(<AdminPanel onClose={vi.fn()} />)
    login('parentcode123')
    await screen.findByText('Demo Kid')
  }

  it('cancelling the confirmation does not delete anything', async () => {
    await renderLoggedIn()

    // Demo Kid is PROFILES[0], rendered first.
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Demo Kid')).toBeTruthy()
    expect(global.fetch).toHaveBeenCalledTimes(2) // login + initial list only
  })

  it('confirming removes the row and sends the admin password header', async () => {
    await renderLoggedIn()

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await waitFor(() => expect(screen.queryByText('Demo Kid')).toBeNull())
    expect(screen.getByText('Rami')).toBeTruthy()

    const deleteCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(([url]) => url === '/api/profiles/1')
    expect(deleteCall?.[1]).toMatchObject({ method: 'DELETE', headers: { 'X-Admin-Password': 'parentcode123' } })
  })
})

describe('AdminPanel edit flow', () => {
  it('prefills the form and saves changes with the admin password header', async () => {
    const updated: Profile = { ...PROFILES[0], name: 'Renamed' }
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/admin/login') return Promise.resolve({ ok: true, status: 204 } as Response)
      if (url === '/api/profiles' && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => PROFILES } as Response)
      }
      if (url === '/api/profiles/1' && init?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => updated } as Response)
      }
      throw new Error(`unexpected fetch: ${url} ${init?.method}`)
    }) as unknown as typeof fetch

    render(<AdminPanel onClose={vi.fn()} />)
    login('parentcode123')
    await screen.findByText('Demo Kid')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])

    const nameInput = await screen.findByDisplayValue('Demo Kid')
    fireEvent.change(nameInput, { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByText('Players')
    const patchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url, init]) => url === '/api/profiles/1' && (init as RequestInit)?.method === 'PATCH',
    )
    const patchInit = patchCall?.[1] as RequestInit
    expect(patchInit).toMatchObject({ headers: { 'X-Admin-Password': 'parentcode123' } })
    expect(JSON.parse(patchInit.body as string)).toMatchObject({ name: 'Renamed' })
  })
})
