import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ZombieMathBlaster } from './ZombieMathBlaster'
import type { Item } from '../types/generated'

/**
 * Integration tests for the 3D game's React orchestration layer — phase
 * transitions, API side effects, mouse point-and-click shooting, and the
 * life-loss/victory/game-over flows. These deliberately never touch real WebGL:
 * `@react-three/fiber`'s `Canvas` and `EquationOutbreakScene` are both
 * mocked to plain DOM so jsdom never needs a GPU context. The bulk of
 * gameplay-rule verification (damage thresholds, telemetry, wave
 * resolution) lives in `zombieWaveEngine.test.ts` — these tests only need
 * to confirm the component wires that engine up correctly.
 *
 * The mock scene exposes one head-hit and one body-hit button per carrier,
 * plus a background-miss button on the mock Canvas, so tests can drive any
 * hit/miss scenario without a raycaster.
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
        carriers: { id: string; label: string; correct: boolean; status: string }[]
        onHit: (carrierId: string, zone: 'head' | 'body') => void
      }) => (
        <div data-testid="mock-scene">
          {props.carriers.map((c) => (
            <div key={c.id}>
              <button onClick={() => props.onHit(c.id, 'head')}>{`headshot ${c.label}`}</button>
              <button onClick={() => props.onHit(c.id, 'body')}>{`bodyshot ${c.label}`}</button>
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
  { answer: 12, options: [12, 13, 11, 10] },
  { answer: 4, options: [3, 4, 5, 6] },
]

function makeItem(i: number, answer: number, options: number[], approachMs = 8000): Item {
  return {
    item_id: `item-${i}`,
    game_id: 'fact_fluency',
    level: 2,
    payload: { left: 3, operator: '+', right: answer - 3, answer, options, approach_ms: approachMs },
  }
}

let attemptPayloads: unknown[] = []

function mockFetchSequence(rounds: typeof ROUNDS, approachMs?: number) {
  let nextItemIndex = 0
  attemptPayloads = []
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('/api/items/next')) {
      const round = rounds[Math.min(nextItemIndex, rounds.length - 1)]
      const item = makeItem(nextItemIndex, round.answer, round.options, approachMs)
      nextItemIndex += 1
      return Promise.resolve({ ok: true, json: async () => item } as Response)
    }
    if (url.startsWith('/api/attempts')) {
      if (init?.body) attemptPayloads.push(JSON.parse(String(init.body)))
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

// Longer than STARTER_BLASTER.cockingMs (900ms) — a wrong first shot begins
// a real, non-fireable cocking window before the second shot is accepted.
async function waitCooldown() {
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

describe('ZombieMathBlaster (Equation Outbreak) — session flow', () => {
  beforeEach(() => {
    mockFetchSequence(ROUNDS)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it(
    'wins via five correct headshots and shows the Equation Outbreak victory copy',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()

      for (const round of ROUNDS) {
        await headshot(round.answer)
        await waitCooldown()
      }

      expect(await screen.findByText('You stopped the Equation Outbreak!', undefined, { timeout: 3000 })).toBeTruthy()
      expect(attemptPayloads).toHaveLength(5)
      for (const payload of attemptPayloads as Array<{ telemetry: { correct: boolean } }>) {
        expect(payload.telemetry.correct).toBe(true)
      }
    },
    20000,
  )

  it(
    'a correct body shot solves the wave immediately (not just a headshot)',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()

      await bodyshot(ROUNDS[0].answer)

      expect(await screen.findByText(`headshot ${ROUNDS[1].answer}`, undefined, { timeout: 3000 })).toBeTruthy()
      expect(attemptPayloads).toHaveLength(1)
      expect((attemptPayloads[0] as { telemetry: { correct: boolean } }).telemetry.correct).toBe(true)
    },
    15000,
  )

  it(
    'defeating one wrong zombie accelerates the wave but keeps it going',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()

      const round = ROUNDS[0]
      const wrongValue = round.options.find((v) => v !== round.answer)!
      await headshot(wrongValue) // defeats a wrong carrier immediately

      // The wave should still be pending — the correct carrier is still shootable.
      await waitCooldown()
      await headshot(round.answer)
      expect(await screen.findByText(`headshot ${ROUNDS[1].answer}`, undefined, { timeout: 3000 })).toBeTruthy()
      expect(attemptPayloads).toHaveLength(1)
      expect((attemptPayloads[0] as { telemetry: { hints_used: number } }).telemetry.hints_used).toBe(1)
    },
    15000,
  )

  it(
    'defeating a second wrong zombie ends the round, shows the frozen result, and Next Question continues',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()

      const round = ROUNDS[0]
      const wrongValues = round.options.filter((v) => v !== round.answer)
      await headshot(wrongValues[0])
      await waitCooldown()
      await headshot(wrongValues[1])

      // "Too many wrong targets!" is announced via the aria-live region as
      // soon as the impact phase starts, before the frozen panel itself
      // renders (after the impact-to-frozen delay) — wait for the panel's
      // own "Lives left" text, which only exists once it's actually shown.
      expect(await screen.findByText(/Lives left: 2/, {}, { timeout: 3000 })).toBeTruthy()

      // Must NOT auto-advance — the next equation only loads after "Next Question".
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(screen.queryByText(`headshot ${ROUNDS[1].answer}`)).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: /next question/i }))
      expect(await screen.findByText(`headshot ${ROUNDS[1].answer}`, undefined, { timeout: 3000 })).toBeTruthy()
    },
    15000,
  )

  it(
    'losing all three lives ends the session at game over, not the next question',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()

      for (let life = 0; life < 3; life++) {
        const round = ROUNDS[Math.min(life, ROUNDS.length - 1)]
        const wrongValues = round.options.filter((v) => v !== round.answer)
        await headshot(wrongValues[0])
        await waitCooldown()
        await headshot(wrongValues[1])
        if (life < 2) {
          fireEvent.click(await screen.findByRole('button', { name: /next question/i }, { timeout: 3000 }))
        }
      }

      expect(await screen.findByText(/outbreak got the better of you/i, undefined, { timeout: 3000 })).toBeTruthy()
      expect(screen.queryByRole('button', { name: /next question/i })).toBeNull()
    },
    25000,
  )

  it(
    'mouse point-and-click: clicking the on-screen answer button shoots at that target',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()

      // The accessible answer list renders one real, mouse-clickable button
      // per active carrier — this exercises the production click handler
      // directly, rather than the mocked 3D scene's head/body buttons. One
      // click fires a body shot, which now immediately defeats the correct
      // carrier and solves the wave.
      const round = ROUNDS[0]
      const answerButton = await screen.findByRole('button', { name: `Zap the zombie carrying ${round.answer}` }, { timeout: 3000 })
      fireEvent.click(answerButton)

      expect(await screen.findByText(`headshot ${ROUNDS[1].answer}`, undefined, { timeout: 3000 })).toBeTruthy()
      expect(attemptPayloads).toHaveLength(1)
    },
    15000,
  )

  it('background misses do not submit an attempt or change the score', async () => {
    render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
    await start()
    await screen.findByText(`headshot ${ROUNDS[0].answer}`, {}, { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: 'background miss' }))
    await waitCooldown()
    expect(attemptPayloads).toHaveLength(0)
    expect(screen.getByText('0 / 5')).toBeTruthy()
  })
})

describe('ZombieMathBlaster — reduced motion', () => {
  beforeEach(() => {
    mockFetchSequence(ROUNDS)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders without the shake animation when prefers-reduced-motion is set', async () => {
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    vi.stubGlobal('matchMedia', matchMediaMock)

    render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
    await start()
    await screen.findByText(`headshot ${ROUNDS[0].answer}`, {}, { timeout: 3000 })
    expect(matchMediaMock).toHaveBeenCalled()
  })
})

describe('ZombieMathBlaster — render-loop cleanup', () => {
  beforeEach(() => {
    mockFetchSequence(ROUNDS)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('cancels the animation frame loop on unmount without throwing', async () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame')
    const { unmount } = render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
    await start()
    await screen.findByText(`headshot ${ROUNDS[0].answer}`, {}, { timeout: 3000 })
    expect(() => unmount()).not.toThrow()
    expect(cancelSpy).toHaveBeenCalled()
  })
})
