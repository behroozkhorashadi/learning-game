import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ProfilePicker } from './ProfilePicker'
import type { Profile } from '../types/generated'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PROFILES: Profile[] = [
  { id: 1, name: 'Demo Kid', avatar: 'fox', birth_year: 2020, reading_support: false },
  { id: 2, name: 'Rami', avatar: 'rami', birth_year: 2019, reading_support: false },
]

function mockProfiles() {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => PROFILES } as Response)) as unknown as typeof fetch
}

describe('ProfilePicker', () => {
  it('renders every profile plus an Add-a-player tile and an Admin link', async () => {
    mockProfiles()
    render(<ProfilePicker onSelect={vi.fn()} onAddPlayer={vi.fn()} onOpenAdmin={vi.fn()} />)

    expect(await screen.findByText('Demo Kid')).toBeTruthy()
    expect(screen.getByText('Rami')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add a player' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Admin' })).toBeTruthy()
  })

  it('selecting a profile calls onSelect with that profile', async () => {
    mockProfiles()
    const onSelect = vi.fn()
    render(<ProfilePicker onSelect={onSelect} onAddPlayer={vi.fn()} onOpenAdmin={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: /Play as Rami/i }))

    expect(onSelect).toHaveBeenCalledWith(PROFILES[1])
  })

  it('the Add a player tile calls onAddPlayer', async () => {
    mockProfiles()
    const onAddPlayer = vi.fn()
    render(<ProfilePicker onSelect={vi.fn()} onAddPlayer={onAddPlayer} onOpenAdmin={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add a player' }))

    expect(onAddPlayer).toHaveBeenCalled()
  })

  it('the Admin link calls onOpenAdmin', () => {
    mockProfiles()
    const onOpenAdmin = vi.fn()
    render(<ProfilePicker onSelect={vi.fn()} onAddPlayer={vi.fn()} onOpenAdmin={onOpenAdmin} />)

    fireEvent.click(screen.getByRole('button', { name: 'Admin' }))

    expect(onOpenAdmin).toHaveBeenCalled()
  })
})
