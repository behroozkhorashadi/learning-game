import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ProfilePicker, ProfileAvatar } from './ProfilePicker'
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
    render(<ProfilePicker onSelect={vi.fn()} onAddPlayer={vi.fn()} onEditProfile={vi.fn()} onOpenAdmin={vi.fn()} />)

    expect(await screen.findByText('Demo Kid')).toBeTruthy()
    expect(screen.getByText('Rami')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add a player' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Admin' })).toBeTruthy()
  })

  it('selecting a profile calls onSelect with that profile', async () => {
    mockProfiles()
    const onSelect = vi.fn()
    render(<ProfilePicker onSelect={onSelect} onAddPlayer={vi.fn()} onEditProfile={vi.fn()} onOpenAdmin={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: /Play as Rami/i }))

    expect(onSelect).toHaveBeenCalledWith(PROFILES[1])
  })

  it('the Add a player tile calls onAddPlayer', async () => {
    mockProfiles()
    const onAddPlayer = vi.fn()
    render(<ProfilePicker onSelect={vi.fn()} onAddPlayer={onAddPlayer} onEditProfile={vi.fn()} onOpenAdmin={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add a player' }))

    expect(onAddPlayer).toHaveBeenCalled()
  })

  it('the Admin link calls onOpenAdmin', () => {
    mockProfiles()
    const onOpenAdmin = vi.fn()
    render(<ProfilePicker onSelect={vi.fn()} onAddPlayer={vi.fn()} onEditProfile={vi.fn()} onOpenAdmin={onOpenAdmin} />)

    fireEvent.click(screen.getByRole('button', { name: 'Admin' }))

    expect(onOpenAdmin).toHaveBeenCalled()
  })

  it("a profile's pencil calls onEditProfile with that profile, not onSelect", async () => {
    mockProfiles()
    const onSelect = vi.fn()
    const onEditProfile = vi.fn()
    render(<ProfilePicker onSelect={onSelect} onAddPlayer={vi.fn()} onEditProfile={onEditProfile} onOpenAdmin={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Rami' }))

    expect(onEditProfile).toHaveBeenCalledWith(PROFILES[1])
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('ProfileAvatar', () => {
  it('shows an animal key as its emoji right away, without requesting art', () => {
    const { container } = render(<ProfileAvatar avatar="fox" name="Nora" />)
    expect(container.textContent).toBe('🦊')
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows a saved photo as an image', () => {
    const { container } = render(<ProfileAvatar avatar="/static/profile-avatars/a.jpg" name="Nora" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/static/profile-avatars/a.jpg')
  })

  it('falls back to the initial when an image fails, and retries when the avatar changes', () => {
    const { container, rerender } = render(<ProfileAvatar avatar="rami" name="Rami" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/avatars/rami.png')

    fireEvent.error(container.querySelector('img')!)
    expect(container.textContent).toBe('R')

    rerender(<ProfileAvatar avatar="/static/profile-avatars/new.jpg" name="Rami" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/static/profile-avatars/new.jpg')
  })
})
