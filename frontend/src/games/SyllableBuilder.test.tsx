import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitForElementToBeRemoved } from '@testing-library/react'
import { SyllableBuilder } from './SyllableBuilder'
import type { Item } from '../types/generated'

/**
 * Regression test for a real bug: the session-complete screen never appeared
 * after 5 correct answers because progress was deduped by word text, and a
 * repeated word (which the backend legitimately serves once a pool is
 * exhausted — see `generate_item`'s fallback) silently didn't count. This
 * drives 5 rounds through mocked network calls and asserts the wrap-up
 * screen actually renders, including a round where the *same* word repeats.
 */

function makeItem(i: number, targetWord: string): Item {
  return {
    item_id: `item-${i}`,
    game_id: 'syllable_builder',
    level: 3,
    payload: {
      target_word: targetWord,
      correct_syllables: ['a', 'b'],
      tiles: ['a', 'b'],
    },
  }
}

// Word "umbrella" deliberately repeats at round 4, mirroring the exhausted-pool
// fallback that triggered the original bug report.
const WORDS = ['elephant', 'computer', 'umbrella', 'umbrella', 'dinosaur']

async function placeAndCheck() {
  const tileA = await screen.findByRole('button', { name: 'a' })
  fireEvent.pointerDown(tileA, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 0 })

  const tileB = await screen.findByRole('button', { name: 'b' })
  fireEvent.pointerDown(tileB, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 0 })

  const checkButton = screen.getByRole('button', { name: /check it/i })
  fireEvent.click(checkButton)

  await screen.findByText('You built it!')
}

describe('SyllableBuilder session flow', () => {
  beforeEach(() => {
    let nextItemIndex = 0
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/items/next')) {
        const item = makeItem(nextItemIndex, WORDS[nextItemIndex])
        nextItemIndex += 1
        return Promise.resolve({ ok: true, json: async () => item } as Response)
      }
      if (url.startsWith('/api/attempts')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            id: 1,
            correct: true,
            score: null,
            hints_used: 0,
            time_ms: 100,
            event_id: 'evt-00000001',
            hint_offered: false,
          }),
        } as Response)
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('reaches the wrap-up screen after 5 correct answers, even with a repeated word', async () => {
    render(<SyllableBuilder profileId={1} onBack={() => {}} />)

    for (let round = 0; round < WORDS.length - 1; round++) {
      await placeAndCheck()
      const playAgain = screen.getByRole('button', { name: /play again/i })
      fireEvent.click(playAgain)
      // The old TileAssembly (still showing the "correct" banner for the item
      // just answered) only unmounts once the next item's fetch resolves and
      // a fresh `key={item_id}` remounts it — wait for that swap so the next
      // round's tile queries can't grab the stale, already-answered instance.
      await waitForElementToBeRemoved(() => screen.queryByText('You built it!'))
    }
    await placeAndCheck()

    const banner = await screen.findByText('You built them all!', undefined, { timeout: 2000 })
    expect(banner).toBeTruthy()
  })
})
