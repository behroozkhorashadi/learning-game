import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleIllustrationReveal, assembleModifierDeck } from './writing.assembly.main.ts'

/** The real graph: assembled reveal → pieces adapter → (stubbed) global fetch, on real timers. */

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('writing assemblies', () => {
  it('the reveal asks the backend for the hero illustration', async () => {
    vi.useFakeTimers()
    const fetchFake = vi.fn((_url: string) => Promise.resolve(new Response(JSON.stringify({ piece_id: 'p1', image_url: '/static/h.png', prompt_excerpt: 'x', order: 0, is_hero: true }), { status: 200 })))
    vi.stubGlobal('fetch', fetchFake)
    const IllustrationReveal = assembleIllustrationReveal()
    render(<IllustrationReveal pieceId="p1" pieceTitle="T" wordCount={1} heroExcerpt="x" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000)
    })
    expect(screen.getByText('I drew what you wrote.')).toBeTruthy()
    expect(fetchFake.mock.calls[0]?.[0]).toBe('/api/pieces/p1/illustrations/generate')
  })

  it('the deck renders', () => {
    const ModifierDeck = assembleModifierDeck()
    render(<ModifierDeck onSelectCard={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Draw a card' })).toBeTruthy()
  })
})
