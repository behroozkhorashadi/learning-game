import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { PROFILES, RAMI } from './profile_fixtures.test.lib.ts'
import { ProfilePickerView, type ProfilePickerViewProps } from './profile_picker.pure.ui.tsx'

afterEach(cleanup)

function renderView(overrides: Partial<ProfilePickerViewProps> = {}): ProfilePickerViewProps {
  const props: ProfilePickerViewProps = {
    state: loaded(PROFILES),
    onSelect: vi.fn(),
    onAddPlayer: vi.fn(),
    onEditProfile: vi.fn(),
    onOpenAdmin: vi.fn(),
    ...overrides,
  }
  render(<ProfilePickerView {...props} />)
  return props
}

describe('ProfilePickerView', () => {
  it('renders every profile plus an Add-a-player tile and an Admin link', () => {
    renderView()
    expect(screen.getByText('Demo Kid')).toBeTruthy()
    expect(screen.getByText('Rami')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add a player' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Admin' })).toBeTruthy()
  })

  it('selecting a profile calls onSelect with that profile', () => {
    const { onSelect } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Play as Rami' }))
    expect(onSelect).toHaveBeenCalledWith(RAMI)
  })

  it('names a password-protected profile as needing a password', () => {
    renderView()
    expect(screen.getByRole('button', { name: 'Play as Nora (needs a password)' })).toBeTruthy()
  })

  it('the Add a player tile calls onAddPlayer', () => {
    const { onAddPlayer } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Add a player' }))
    expect(onAddPlayer).toHaveBeenCalled()
  })

  it('the Admin link calls onOpenAdmin', () => {
    const { onOpenAdmin } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }))
    expect(onOpenAdmin).toHaveBeenCalled()
  })

  it("a profile's pencil calls onEditProfile with that profile, not onSelect", () => {
    const { onSelect, onEditProfile } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Rami' }))
    expect(onEditProfile).toHaveBeenCalledWith(RAMI)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('while loading, shows no profiles and no Add tile, but still the Admin link', () => {
    renderView({ state: LOADING })
    expect(screen.queryByRole('button', { name: /Play as/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add a player' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Admin' })).toBeTruthy()
  })

  it('when loading fails, shows the error and no Add tile', () => {
    renderView({ state: failed('GET /api/profiles failed with HTTP 500') })
    expect(screen.getByText('Error: GET /api/profiles failed with HTTP 500')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add a player' })).toBeNull()
  })

  it('with no profiles yet, offers only Add a player', () => {
    renderView({ state: loaded([]) })
    expect(screen.queryByRole('button', { name: /Play as/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add a player' })).toBeTruthy()
  })
})
