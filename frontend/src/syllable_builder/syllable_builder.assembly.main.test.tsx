import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleSyllableBuilder } from './syllable_builder.assembly.main.ts'

/** The real graph: assembled game → practice adapter → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('assembleSyllableBuilder', () => {
  it('loads the first item for this profile and game', async () => {
    const fetchFake = vi.fn((_url: string) =>
      Promise.resolve(new Response(JSON.stringify({ item_id: 'i1', game_id: 'syllable_builder', level: 1, payload: { target_word: 'rabbit', correct_syllables: ['rab', 'bit'], tiles: ['bit', 'rab'] } }), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchFake)
    const SyllableBuilder = assembleSyllableBuilder()
    render(<SyllableBuilder profileId={4} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByRole('button', { name: 'rab' })).toBeTruthy()
    expect(String(fetchFake.mock.calls[0]?.[0])).toMatch(/^\/api\/items\/next\?profile_id=4&game_id=syllable_builder&session_id=[0-9a-f-]{36}$/)
  })

  it('shows a malformed item as an error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ item_id: 'i1', game_id: 'syllable_builder', level: 1, payload: {} }), { status: 200 }))))
    const SyllableBuilder = assembleSyllableBuilder()
    render(<SyllableBuilder profileId={4} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/unexpected payload/)
  })
})
