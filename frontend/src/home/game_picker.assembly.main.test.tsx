import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleGamePicker } from './game_picker.assembly.main.ts'
import { GAMES } from './home_fixtures.test.lib.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('assembleGamePicker', () => {
  it('reads GET /api/games', async () => {
    const fetchFake = vi.fn((_url: string) => Promise.resolve(new Response(JSON.stringify(GAMES), { status: 200 })))
    vi.stubGlobal('fetch', fetchFake)
    const GamePicker = assembleGamePicker()
    render(<GamePicker profile={{ name: 'Rami', birth_year: 2019 }} onSelectGame={vi.fn()} onSwitchProfile={vi.fn()} onEditProfile={vi.fn()} onViewBadges={vi.fn()} onOpenPracticeSettings={vi.fn()} />)
    expect(await screen.findByText('Pathfinder')).toBeTruthy()
    expect(fetchFake.mock.calls[0]?.[0]).toBe('/api/games')
  })
})
