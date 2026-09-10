import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ZombieMathBlaster } from './ZombieMathBlaster'
import type { Item } from '../types/generated'

/**
 * Integration tests for the correctHit/wrongHit/playerAttacked
 * visual-feedback system — kept separate from `ZombieMathBlaster.test.tsx`
 * (which owns the damage/telemetry/life-loss flows) since these are purely
 * about *what feedback renders*, not the underlying wave rules.
 *
 * Same no-WebGL mocking strategy as the other integration suites in this
 * directory: `Canvas` and `EquationOutbreakScene` are replaced with plain
 * DOM so jsdom never needs a GPU context.
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
  { answer: 6, options: [5, 6, 7, 4] },
]

function makeItem(i: number, answer: number, options: number[]): Item {
  return {
    item_id: `item-${i}`,
    game_id: 'fact_fluency',
    level: 2,
    payload: { left: 3, operator: '+', right: answer - 3, answer, options, approach_ms: 8000 },
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

async function bodyshot(value: number) {
  const button = await screen.findByRole('button', { name: `bodyshot ${value}` }, { timeout: 3000 })
  fireEvent.click(button)
}

async function waitCooldown() {
  await new Promise((resolve) => setTimeout(resolve, 650))
}

function vignette() {
  return screen.queryByTestId('answer-feedback-vignette')
}

function containerAnimation(): string {
  return (screen.getByTestId('game-container') as HTMLElement).style.animation
}

describe('ZombieMathBlaster — answer-feedback visuals', () => {
  beforeEach(() => {
    mockFetchSequence(ROUNDS)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it(
    'a correct hit shows exactly one green feedback vignette',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()
      await headshot(ROUNDS[0].answer)

      const el = await screen.findByTestId('answer-feedback-vignette', {}, { timeout: 3000 })
      expect(screen.getAllByTestId('answer-feedback-vignette')).toHaveLength(1)
      expect(el.getAttribute('data-feedback-kind')).toBe('correctHit')
    },
    15000,
  )

  it(
    'a wrong hit (that does not end the wave) shows exactly one red feedback vignette',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()
      const round = ROUNDS[0]
      const wrongValue = round.options.find((v) => v !== round.answer)!
      await headshot(wrongValue)

      const el = await screen.findByTestId('answer-feedback-vignette', {}, { timeout: 3000 })
      expect(screen.getAllByTestId('answer-feedback-vignette')).toHaveLength(1)
      expect(el.getAttribute('data-feedback-kind')).toBe('wrongHit')
    },
    15000,
  )

  it(
    'a background miss shows no answer-feedback vignette',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()
      await screen.findByText(`headshot ${ROUNDS[0].answer}`, {}, { timeout: 3000 })

      fireEvent.click(screen.getByRole('button', { name: 'background miss' }))
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(vignette()).toBeNull()
    },
    15000,
  )

  it(
    'the second wrong-carrier defeat does not show its own small vignette — only the stronger life-lost overlay applies',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()
      const round = ROUNDS[0]
      const wrongValues = round.options.filter((v) => v !== round.answer)

      await headshot(wrongValues[0])
      await screen.findByTestId('answer-feedback-vignette', {}, { timeout: 3000 })
      await waitCooldown() // first wrongHit's own pulse has long since auto-cleared

      await headshot(wrongValues[1])
      // The strong, persistent life-lost overlay (existing behavior) shows —
      // the small auto-clearing vignette must not also be present.
      expect(await screen.findByText(/Lives left: 2/, {}, { timeout: 3000 })).toBeTruthy()
      expect(vignette()).toBeNull()
    },
    15000,
  )

  it(
    'a zombie reaching the player still produces the strong screenShake and ends the wave, without a small answer vignette',
    async () => {
      // Never shoot — let the wave's 8s approach naturally reach the player.
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()

      // "A zombie got through!" fires via the aria-live region as soon as
      // phase becomes 'contact'; the screenShake only starts once phase
      // advances to 'impact' (after CONTACT_HOLD_MS) and lasts until
      // IMPACT_TO_FROZEN_MS — check inside that window, before the frozen
      // result panel (and its "Lives left" text) replaces it.
      expect(await screen.findByText(/A zombie got through!/i, {}, { timeout: 10000 })).toBeTruthy()
      await new Promise((resolve) => setTimeout(resolve, 750))
      expect(containerAnimation()).toContain('screenShake')
      expect(vignette()).toBeNull()
      await screen.findByText(/Lives left: 2/, {}, { timeout: 3000 })
    },
    15000,
  )

  it(
    'an unrelated re-render (mouse move) does not replay or duplicate the feedback event',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()
      await headshot(ROUNDS[0].answer)

      const el = await screen.findByTestId('answer-feedback-vignette', {}, { timeout: 3000 })
      const idAfterHit = el.getAttribute('data-feedback-id')

      const container = screen.getByTestId('game-container')
      fireEvent.pointerMove(container, { clientX: 10, clientY: 10 })
      fireEvent.pointerMove(container, { clientX: 20, clientY: 30 })

      expect(screen.getAllByTestId('answer-feedback-vignette')).toHaveLength(1)
      expect(screen.getByTestId('answer-feedback-vignette').getAttribute('data-feedback-id')).toBe(idAfterHit)
    },
    15000,
  )

  it(
    'headshots and body shots both trigger the correct-hit feedback',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()
      await bodyshot(ROUNDS[0].answer)

      const el = await screen.findByTestId('answer-feedback-vignette', {}, { timeout: 3000 })
      expect(el.getAttribute('data-feedback-kind')).toBe('correctHit')
    },
    15000,
  )
})
