import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindGamePicker } from './game_picker.effect.ui.tsx'
import { GAMES } from './home_fixtures.test.lib.ts'

afterEach(cleanup)

describe('bindGamePicker', () => {
  it('loads the catalog and shows it', async () => {
    const GamePicker = bindGamePicker({ listGames: () => Promise.resolve(GAMES) })
    render(<GamePicker profile={{ name: 'Rami' }} onSelectGame={vi.fn()} onSwitchProfile={vi.fn()} onEditProfile={vi.fn()} onViewBadges={vi.fn()} onOpenPracticeSettings={vi.fn()} />)
    expect(await screen.findByText('Equation Outbreak')).toBeTruthy()
  })
})
