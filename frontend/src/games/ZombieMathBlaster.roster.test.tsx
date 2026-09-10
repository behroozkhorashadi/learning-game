import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ZombieMathBlaster } from './ZombieMathBlaster'
import { selectSessionRoster } from '../lib/zombieRoster'
import { ZOMBIE_CHARACTER_REGISTRY } from '../lib/characterDefinitions'
import type { Item } from '../types/generated'

/**
 * Integration tests for the session/wave character-roster machinery added
 * on top of the existing gameplay orchestration (see
 * `ZombieMathBlaster.test.tsx` for the damage/telemetry/life-loss flows,
 * which this file deliberately doesn't re-test). Same no-WebGL mocking
 * strategy: `EquationOutbreakScene` is replaced with a plain-DOM stand-in,
 * here extended to also surface the `charactersByLane` prop it receives so
 * a test can see which character ended up on which lane without a real
 * Three.js scene.
 */

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: { children?: React.ReactNode; onPointerMissed?: () => void }) => (
    <div data-testid="mock-canvas">
      <button onClick={() => props.onPointerMissed?.()}>background miss</button>
      {props.children}
    </div>
  ),
}))

interface MockCarrier {
  id: string
  value: number
  correct: boolean
  status: string
  lane: number
}
interface MockCharacter {
  id: string
}

vi.mock(
  '../components/EquationOutbreakScene',
  () =>
    ({
      EquationOutbreakScene: (props: { carriers: MockCarrier[]; charactersByLane: MockCharacter[]; onHit: (carrierId: string, zone: 'head' | 'body') => void }) => (
        <div data-testid="mock-scene">
          <div data-testid="roster-ids">{props.charactersByLane.map((c) => c.id).join(',')}</div>
          {props.carriers.map((c) => (
            <div key={c.id}>
              <span data-testid={`character-for-${c.id}`}>{props.charactersByLane[c.lane]?.id}</span>
              <button onClick={() => props.onHit(c.id, 'head')}>{`headshot ${c.value}`}</button>
              <button onClick={() => props.onHit(c.id, 'body')}>{`bodyshot ${c.value}`}</button>
            </div>
          ))}
        </div>
      ),
    }) as Record<string, unknown>,
)

// A real Fisher-Yates shuffle, spied so tests can inspect call count without
// changing behavior — proves *when* a fresh roster is selected (once per
// session, never per wave) rather than just what comes out of it.
vi.mock('../lib/zombieRoster', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/zombieRoster')>()
  return { ...actual, selectSessionRoster: vi.fn(actual.selectSessionRoster) }
})

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

async function waitCooldown() {
  await new Promise((resolve) => setTimeout(resolve, 650))
}

// `charactersByLane` is only populated once the intro beat's timer fires
// (see `ZombieMathBlaster`'s intro-phase effect) — the mock scene mounts
// before that, with an empty roster, so wait for real content rather than
// just for the element to exist.
async function currentRosterIds(): Promise<string[]> {
  await waitFor(
    () => {
      if (!screen.getByTestId('roster-ids').textContent) throw new Error('roster not yet populated')
    },
    { timeout: 3000 },
  )
  return screen.getByTestId('roster-ids').textContent!.split(',').filter(Boolean)
}

const REGISTRY_IDS = ZOMBIE_CHARACTER_REGISTRY.filter((c) => c.enabled).map((c) => c.id)

describe('ZombieMathBlaster — character roster selection', () => {
  beforeEach(() => {
    mockFetchSequence(ROUNDS)
    vi.mocked(selectSessionRoster).mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it(
    'a new session selects a roster of four unique, enabled characters',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()

      const ids = await currentRosterIds()
      expect(ids).toHaveLength(4)
      expect(new Set(ids).size).toBe(4)
      for (const id of ids) expect(REGISTRY_IDS).toContain(id)
      expect(selectSessionRoster).toHaveBeenCalledTimes(1)
    },
    15000,
  )

  it(
    'each wave assigns exactly one instance of each roster member (no duplicate on two lanes)',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()
      const firstWaveIds = await currentRosterIds()
      expect(new Set(firstWaveIds).size).toBe(4)

      // Solve the wave to force a second wave, then check again.
      await headshot(ROUNDS[0].answer)
      await waitCooldown()
      const secondWaveIds = await currentRosterIds()
      expect(new Set(secondWaveIds).size).toBe(4)
    },
    15000,
  )

  it(
    'moving to the next question keeps the same session roster (lane assignment may reshuffle)',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()
      const firstWaveIds = await currentRosterIds()

      await headshot(ROUNDS[0].answer)
      await waitCooldown()
      const secondWaveIds = await currentRosterIds()

      expect([...secondWaveIds].sort()).toEqual([...firstWaveIds].sort())
      // Roster selection itself must not have run again for the new question.
      expect(selectSessionRoster).toHaveBeenCalledTimes(1)
    },
    15000,
  )

  it(
    'losing the session and pressing Try Again selects a fresh roster',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()
      expect(selectSessionRoster).toHaveBeenCalledTimes(1)

      // Lose all three lives via the second-wrong-carrier-defeat path.
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

      const tryAgainButton = await screen.findByRole('button', { name: /try again/i }, { timeout: 3000 })
      fireEvent.click(tryAgainButton)

      const idsAfterRetry = await currentRosterIds()
      expect(new Set(idsAfterRetry).size).toBe(4)
      // The mechanism re-ran for the new session — with today's registry
      // (exactly four enabled characters) the *set* is necessarily the
      // same, but a fresh selection call is the provable guarantee here.
      expect(selectSessionRoster).toHaveBeenCalledTimes(2)
    },
    25000,
  )

  it(
    'solving depends only on the answer value, not on which character is assigned to the correct lane',
    async () => {
      render(<ZombieMathBlaster profileId={1} onBack={() => {}} />)
      await start()
      await currentRosterIds()

      // Whichever character the mock scene shows on the correct-value
      // carrier, headshotting by value still solves the wave.
      await headshot(ROUNDS[0].answer)

      expect(await screen.findByText(`headshot ${ROUNDS[1].answer}`, undefined, { timeout: 3000 })).toBeTruthy()
    },
    15000,
  )
})
