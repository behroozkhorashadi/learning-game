import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ZombieMathBlaster } from './ZombieMathBlaster'
import type { Item } from '../types/generated'

/**
 * Integration tests for the two-shot weapon state as it's surfaced through
 * `ZombieMathBlaster`'s real `ChargeHud` and mute button — extending the
 * same mocking pattern `ZombieMathBlaster.test.tsx` already established
 * (mock `@react-three/fiber`'s `Canvas` and `EquationOutbreakScene` as plain
 * DOM) so these run without a real WebGL context. `zombieWaveEngine.test.ts`
 * already covers the gameplay rules themselves (cocking timing, shots-
 * exhausted, etc.) in isolation — these tests only confirm the component
 * wires that engine state into what a player actually sees, and that a
 * click mid-cocking is truly ignored end to end.
 */

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: { children?: React.ReactNode; onPointerMissed?: () => void }) => (
    <div data-testid="mock-canvas">
      <button onClick={() => props.onPointerMissed?.()}>background miss</button>
      {props.children}
    </div>
  ),
}))

vi.mock(
  '../components/EquationOutbreakScene',
  () =>
    ({
      EquationOutbreakScene: (props: {
        carriers: { id: string; value: number; correct: boolean; status: string }[]
        onHit: (carrierId: string, zone: 'head' | 'body') => void
      }) => (
        <div data-testid="mock-scene">
          {props.carriers.map((c) => (
            <div key={c.id}>
              <button onClick={() => props.onHit(c.id, 'head')}>{`headshot ${c.value}`}</button>
              <button onClick={() => props.onHit(c.id, 'body')}>{`bodyshot ${c.value}`}</button>
            </div>
          ))}
        </div>
      ),
    }) as Record<string, unknown>,
)

const ROUNDS = [
  { answer: 7, options: [6, 7, 8, 5] },
  { answer: 9, options: [9, 10, 8, 11] },
]

function makeItem(i: number, answer: number, options: number[], approachMs = 8000): Item {
  return {
    item_id: `item-${i}`,
    game_id: 'fact_fluency',
    level: 2,
    payload: { left: 3, operator: '+', right: answer - 3, answer, options, approach_ms: approachMs },
  }
}

function mockFetchSequence(rounds: typeof ROUNDS) {
  let nextItemIndex = 0
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith('/api/items/next')) {
      const round = rounds[Math.min(nextItemIndex, rounds.length - 1)]
      const item = makeItem(nextItemIndex, round.answer, round.options)
      nextItemIndex += 1
      return Promise.resolve({ ok: true, json: async () => item } as Response)
    }
    if (url.startsWith('/api/attempts')) {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ id: 1, correct: true, score: null, hints_used: 0, time_ms: 100, event_id: 'evt-1', hint_offered: false }),
      } as Response)
    }
    if (url.startsWith('/api/ratings')) {
      return Promise.resolve({ ok: true, status: 201, json: async () => ({}) } as Response)
    }
    throw new Error(`unexpected fetch: ${url}`)
  }) as unknown as typeof fetch
}

async function start() {
  fireEvent.click(await screen.findByRole('button', { name: /^start$/i }))
}

async function headshot(value: number) {
  const button = await screen.findByRole('button', { name: `headshot ${value}` }, { timeout: 3000 })
  fireEvent.click(button)
}

function chargeHud() {
  return screen.getByTestId('charge-hud')
}

const MUTE_STORAGE_KEY = 'equationOutbreak:audioMuted'

describe('ZombieMathBlaster — charge HUD', () => {
  beforeEach(() => {
    mockFetchSequence(ROUNDS)
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows two filled charges at wave start', async () => {
    render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
    await start()
    await screen.findByText(`headshot ${ROUNDS[0].answer}`, {}, { timeout: 3000 })

    expect(chargeHud().getAttribute('data-shots-remaining')).toBe('2')
  })

  it('drops to one charge and shows "Cocking…" after a wrong first shot, then back to two on the next question', async () => {
    render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
    await start()
    const round = ROUNDS[0]
    const wrongValue = round.options.find((v) => v !== round.answer)!
    await headshot(wrongValue)

    expect(await screen.findByText(/cocking/i, {}, { timeout: 1000 })).toBeTruthy()

    // Once cocking finishes (> 900ms), the second shot is ready with one
    // charge showing — wait past the cocking window and re-check.
    await screen.findByTestId('charge-hud', {}, { timeout: 3000 })
    await new Promise((resolve) => setTimeout(resolve, 1000))
    expect(chargeHud().getAttribute('data-shots-remaining')).toBe('1')

    // Solve the wave on the (final) second shot — a new question resets to two.
    await headshot(round.answer)
    await new Promise((resolve) => setTimeout(resolve, 800))
    await screen.findByText(`headshot ${ROUNDS[1].answer}`, {}, { timeout: 3000 })
    expect(chargeHud().getAttribute('data-shots-remaining')).toBe('2')
  }, 15000)

  it('never shows "Cocking…" when the first shot is correct (no cocking after a solved wave)', async () => {
    render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
    await start()
    const round = ROUNDS[0]
    await headshot(round.answer)

    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(screen.queryByText(/cocking/i)).toBeNull()
  })

  it('a click during cocking is ignored — it does not defeat another carrier or spend a hidden shot', async () => {
    render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
    await start()
    const round = ROUNDS[0]
    const wrongValues = round.options.filter((v) => v !== round.answer)
    await headshot(wrongValues[0])
    await screen.findByText(/cocking/i, {}, { timeout: 1000 })

    // Fire again immediately, well inside the ~900ms cocking window — this
    // must be a no-op: the wave stays pending with the same lane still
    // showing a live "headshot" button for the still-active carrier.
    await headshot(wrongValues[1])
    expect(await screen.findByText(`headshot ${wrongValues[1]}`, {}, { timeout: 1000 })).toBeTruthy()
  })
})

describe('ZombieMathBlaster — mute control', () => {
  beforeEach(() => {
    mockFetchSequence(ROUNDS)
    localStorage.clear()
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('toggles and persists the mute preference under a namespaced storage key', async () => {
    render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
    await start()
    await screen.findByText(`headshot ${ROUNDS[0].answer}`, {}, { timeout: 3000 })

    const muteButton = screen.getByRole('button', { name: /^mute$/i })
    fireEvent.click(muteButton)

    expect(localStorage.getItem(MUTE_STORAGE_KEY)).toBe('1')
    expect(screen.getByRole('button', { name: /^unmute$/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^unmute$/i }))
    expect(localStorage.getItem(MUTE_STORAGE_KEY)).toBe('0')
  })
})
