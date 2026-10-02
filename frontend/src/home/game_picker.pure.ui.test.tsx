import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { GamePickerView, type GamePickerViewProps } from './game_picker.pure.ui.tsx'
import { GAMES } from './home_fixtures.test.lib.ts'

afterEach(cleanup)

function renderPicker(overrides: Partial<GamePickerViewProps> = {}): GamePickerViewProps {
  const props: GamePickerViewProps = { games: loaded(GAMES), profile: { name: 'Rami', birth_year: new Date().getFullYear() - 9 }, onSelectGame: vi.fn(), onSwitchProfile: vi.fn(), onEditProfile: vi.fn(), onViewBadges: vi.fn(), onOpenPracticeSettings: vi.fn(), ...overrides }
  render(<GamePickerView {...props} />)
  return props
}

describe('GamePickerView', () => {
  it('greets the player and shows only the games on the trimmed roster', () => {
    renderPicker()
    expect(screen.getByText('Hi Rami')).toBeTruthy()
    expect(screen.getByText('Equation Outbreak')).toBeTruthy()
    expect(screen.getByText('Pathfinder')).toBeTruthy()
    expect(screen.queryByText('Syllable Builder')).toBeNull()
  })

  it('shows Syllable Builder to players aged 6 through 8', () => {
    renderPicker({ profile: { name: 'Rami', birth_year: new Date().getFullYear() - 7 } })
    expect(screen.getByText('Syllable Builder')).toBeTruthy()
  })

  it('shows a practice-settings gear only on Equation Outbreak', () => {
    renderPicker()
    expect(screen.getByRole('button', { name: 'Practice settings for Equation Outbreak' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Practice settings for Pathfinder' })).toBeNull()
  })

  it('the gear opens practice settings without also selecting the game', () => {
    const props = renderPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Practice settings for Equation Outbreak' }))
    expect(props.onOpenPracticeSettings).toHaveBeenCalledWith('fact_fluency')
    expect(props.onSelectGame).not.toHaveBeenCalled()
  })

  it('the tile selects the game; the header buttons reach badges, edit, and switch', () => {
    const props = renderPicker()
    fireEvent.click(screen.getByText('Equation Outbreak'))
    fireEvent.click(screen.getByRole('button', { name: 'View badges' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch player' }))
    expect(props.onSelectGame).toHaveBeenCalledWith('fact_fluency')
    expect([props.onViewBadges, props.onEditProfile, props.onSwitchProfile].map((f) => vi.mocked(f).mock.calls.length)).toEqual([1, 1, 1])
  })

  it('renders loading as an empty home and a failure as an error', () => {
    renderPicker({ games: LOADING })
    expect(screen.queryByRole('button', { name: /Practice settings/ })).toBeNull()
    cleanup()
    renderPicker({ games: failed('GET /api/games failed with HTTP 500') })
    expect(screen.getByRole('alert').textContent).toBe('Error: GET /api/games failed with HTTP 500')
  })
})
