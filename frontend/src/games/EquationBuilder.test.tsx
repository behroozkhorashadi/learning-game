import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitForElementToBeRemoved } from '@testing-library/react'
import { EquationBuilder } from './EquationBuilder'
import type { Item } from '../types/generated'

/**
 * Drives a full 5-round session through mocked network calls, mirroring
 * SyllableBuilder.test.tsx's session-flow regression test but for a fully
 * objective game with no paper-handoff/parent-verify phase: the wrap-up
 * screen should appear right after the 5th correct tile placement.
 */

function makeItem(i: number, answer: number, tiles: string[]): Item {
  return {
    item_id: `item-${i}`,
    game_id: 'equation_builder',
    level: 2,
    payload: { left: 3, operator: '+', right: 4, answer, missing: 'answer', tiles },
  }
}

const ROUNDS = [
  { answer: 7, tiles: ['7', '8'] },
  { answer: 9, tiles: ['9', '10'] },
  { answer: 6, tiles: ['6', '5'] },
  { answer: 5, tiles: ['5', '4'] },
  { answer: 12, tiles: ['12', '11'] },
]

async function placeAndCheck(correctLabel: string) {
  const tile = await screen.findByRole('button', { name: correctLabel })
  fireEvent.pointerDown(tile, { pointerId: 1, clientX: 0, clientY: 0 })
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 0 })

  const checkButton = screen.getByRole('button', { name: /check it/i })
  fireEvent.click(checkButton)

  await screen.findByText('You built it!')
}

describe('EquationBuilder session flow', () => {
  beforeEach(() => {
    let nextItemIndex = 0
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/items/next')) {
        const round = ROUNDS[nextItemIndex]
        const item = makeItem(nextItemIndex, round.answer, round.tiles)
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

  it('reaches the wrap-up screen after 5 correct answers, with no handoff/verify step', async () => {
    render(<EquationBuilder profileId={1} onBack={() => {}} />)

    const startButton = await screen.findByRole('button', { name: /^start$/i })
    fireEvent.click(startButton)

    for (let round = 0; round < ROUNDS.length - 1; round++) {
      await placeAndCheck(String(ROUNDS[round].answer))
      const playAgain = screen.getByRole('button', { name: /play again/i })
      fireEvent.click(playAgain)
      await waitForElementToBeRemoved(() => screen.queryByText('You built it!'))
    }
    await placeAndCheck(String(ROUNDS[ROUNDS.length - 1].answer))

    const banner = await screen.findByText('You solved them all!', undefined, { timeout: 2000 })
    expect(banner).toBeTruthy()
    for (const round of ROUNDS) {
      expect(screen.getByText(`3 + 4 = ${round.answer}`)).toBeTruthy()
    }
  })
})
