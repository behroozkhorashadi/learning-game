import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { GamePicker } from './GamePicker'
import type { GameMetadata, Profile } from '../types/generated'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PROFILE: Profile = { id: 2, name: 'Rami', avatar: 'rami', birth_year: 2019, reading_support: false }

const GAMES: GameMetadata[] = [
  { id: 'fact_fluency', title: 'Equation Outbreak', tagline: 'Solve the facts. Stop the horde.', skill_ids: [], min_age: 8, max_age: 12, icon: '💥', max_level: 10 },
  { id: 'pathfinder_no_way_back', title: 'Pathfinder', tagline: 'Find the way.', skill_ids: [], min_age: 8, max_age: 12, icon: '🧭', max_level: 10 },
]

function renderPicker(overrides: Partial<React.ComponentProps<typeof GamePicker>> = {}) {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => GAMES } as Response)) as unknown as typeof fetch
  return render(
    <GamePicker
      profile={PROFILE}
      onSelectGame={vi.fn()}
      onSwitchProfile={vi.fn()}
      onViewBadges={vi.fn()}
      onOpenStorybook={vi.fn()}
      onOpenPracticeSettings={vi.fn()}
      {...overrides}
    />,
  )
}

describe('GamePicker', () => {
  it('shows a practice-settings gear only on Equation Outbreak, not other games', async () => {
    renderPicker()

    await screen.findByText('Equation Outbreak')
    expect(screen.getByText('Pathfinder')).toBeTruthy()

    expect(screen.getByRole('button', { name: /Practice settings for Equation Outbreak/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Practice settings for Pathfinder/i })).toBeNull()
  })

  it('clicking the gear opens practice settings without also selecting the game', async () => {
    const onSelectGame = vi.fn()
    const onOpenPracticeSettings = vi.fn()
    renderPicker({ onSelectGame, onOpenPracticeSettings })

    fireEvent.click(await screen.findByRole('button', { name: /Practice settings for Equation Outbreak/i }))

    expect(onOpenPracticeSettings).toHaveBeenCalledWith('fact_fluency')
    expect(onSelectGame).not.toHaveBeenCalled()
  })

  it('clicking the tile itself selects the game', async () => {
    const onSelectGame = vi.fn()
    renderPicker({ onSelectGame })

    fireEvent.click(await screen.findByText('Equation Outbreak'))

    expect(onSelectGame).toHaveBeenCalledWith('fact_fluency')
  })
})
