import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AttemptBody, ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import { recordingAudio, virtualScheduler } from '@app/outbreak/arena_fakes.test.ui.tsx'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { NO_ROUND_ARMOR, STARTER_LOADOUT, loadoutFor } from './horde_armory.pure.lib.ts'
import { EASY } from './horde_difficulty.pure.lib.ts'
import { hordeItem, rightAnswer } from './horde_fakes.test.ui.tsx'
import { POINTS } from './horde_scoring.pure.lib.ts'
import { INTRO_MS, NEXT_QUESTION_MS, OUT_OF_ROUNDS_MS, SHOVE_EARNED_MS, useHordeRound, type HordeRoundDeps } from './use_horde_round.pure.hook.ts'

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (v: T) => void; readonly reject: (e: Error) => void } {
  let resolve: (v: T) => void = () => undefined
  let reject: (e: Error) => void = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Deps whose items and bank answer when the test says. */
function controlled() {
  const items: ReturnType<typeof deferred<ItemRecord>>[] = []
  const banks: ReturnType<typeof deferred<{ readonly balance: number }>>[] = []
  const banked: Parameters<HordeRoundDeps['bankRound']>[1][] = []
  const attempts: AttemptBody[] = []
  const scheduler = virtualScheduler()
  const deps: HordeRoundDeps = {
    nextItem: () => {
      const d = deferred<ItemRecord>()
      items.push(d)
      return d.promise
    },
    recordAttempt: (attempt) => {
      attempts.push(attempt)
      return Promise.resolve()
    },
    bankRound: (_profileId, round) => {
      banked.push(round)
      const d = deferred<{ readonly balance: number }>()
      banks.push(d)
      return d.promise
    },
    scheduler,
    audio: recordingAudio(),
    pickRoster: () => ZOMBIE_CHARACTER_REGISTRY.slice(0, 4),
    createSessionId: () => 'session',
    newSeed: () => 7,
    reportError: () => undefined,
    saveReplay: () => Promise.resolve(),
    nowIso: () => '2026-10-11T12:00:00.000Z',
    travelMsFor: () => 600_000,
  }
  return { deps, items, banks, banked, attempts, scheduler }
}

describe('useHordeRound', () => {
  it('loads the first question, fetches the next one ahead, and plays after the intro', async () => {
    const { deps, items, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0, 0)
    })
    expect(result.current.phase).toBe('loading')
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 60_000))
    })
    expect(result.current.phase).toBe('intro')
    expect(result.current.state?.question?.text).toBe('3 + 4 =')
    expect(items).toHaveLength(2)
    await scheduler.advance(INTRO_MS + 20)
    expect(result.current.phase).toBe('playing')
  })

  it('shows the prefetched question after a right answer, and fetches the one after', async () => {
    const { deps, items, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0, 0)
    })
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 60_000))
    })
    // The next question was asked for as soon as the first arrived.
    await act(async () => {
      items[1]?.resolve(hordeItem(1, 60_000))
    })
    await scheduler.advance(INTRO_MS + 20)
    const state = result.current.state
    const right = state?.zombies.find((z) => state.answers[z.slot]?.label === String(rightAnswer(0)))
    act(() => {
      result.current.shoot({ zombieId: right?.id ?? '', zone: 'body' }, { aim: null, blockedBy: null, via: 'button' })
    })
    expect(result.current.state?.question).toBeNull()
    await scheduler.advance(NEXT_QUESTION_MS + 20)
    expect(result.current.state?.question?.text).toBe('3 + 6 =')
    expect(items).toHaveLength(3)
  })

  it('drops a first question that arrives after going back to the start', async () => {
    const { deps, items } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0, 0)
      result.current.reset()
    })
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 60_000))
    })
    expect(result.current.phase).toBe('ready')
    expect(result.current.state).toBeNull()
  })

  it('drops a late question after unmount', async () => {
    const { deps, items } = controlled()
    const { result, unmount } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0, 0)
    })
    unmount()
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 60_000))
    })
    expect(result.current.phase).toBe('loading')
  })

  // Plays a whole 60-second round frame by frame on the virtual clock, then stops in overtime.
  it("says so when the round's points can't be banked", { timeout: 30_000 }, async () => {
    const { deps, items, banks, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0, 0)
    })
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 600_000))
    })
    await scheduler.advance(INTRO_MS + 60_100)
    act(() => {
      result.current.endOvertime()
    })
    expect(result.current.phase).toBe('over')
    expect(result.current.bank).toEqual({ kind: 'saving' })
    await act(async () => {
      banks[0]?.reject(new Error('offline'))
    })
    expect(result.current.bank).toEqual({ kind: 'failed', message: 'offline' })
  })

  it('arms a grenade only with grenades to throw', async () => {
    const { deps, items, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 0, 0, 0)
    })
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 60_000))
    })
    await scheduler.advance(INTRO_MS + 20)
    act(() => {
      result.current.toggleGrenade()
    })
    expect(result.current.armed).toBe('shot')
  })

  it('plays on past the clock into overtime, and stopping banks the round with how long it lasted', { timeout: 30_000 }, async () => {
    const { deps, items, banked, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0, 0)
    })
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 600_000))
    })
    await scheduler.advance(INTRO_MS + 30_000)
    act(() => {
      result.current.endOvertime()
    })
    expect(result.current.phase).toBe('playing')
    await scheduler.advance(30_100)
    expect(result.current.phase).toBe('playing')
    expect(result.current.state?.livesAtClock).toBe(3)
    expect(result.current.liveMessage).toContain('Overtime')
    act(() => {
      result.current.endOvertime()
    })
    expect(result.current.phase).toBe('over')
    expect(result.current.result?.livesAtClock).toBe(3)
    expect(banked).toHaveLength(1)
    expect(banked[0]?.survived_ms).toBeGreaterThanOrEqual(60_000)
    // Medium: every line at 0.6.
    expect(banked[0]).toMatchObject({ points: Math.round(POINTS.survived * 0.6) + Math.round(3 * POINTS.lifeLeft * 0.6), difficulty: 'medium' })
  })

  it('plays and banks on the chosen difficulty: a slower walk on easy, at full points', { timeout: 30_000 }, async () => {
    const { deps, items, banked, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0, 0, NO_ROUND_ARMOR, EASY)
    })
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 600_000))
    })
    expect(result.current.difficulty).toBe(EASY)
    await scheduler.advance(INTRO_MS + 60_100)
    act(() => {
      result.current.endOvertime()
    })
    expect(banked[0]).toMatchObject({ points: POINTS.survived + 3 * POINTS.lifeLeft, difficulty: 'easy' })
  })

  it('announces a new personal best the moment it is passed, and scores the bonus', { timeout: 30_000 }, async () => {
    const { deps, items, banked, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0, 61_000)
    })
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 600_000))
    })
    expect(result.current.previousBestMs).toBe(61_000)
    await scheduler.advance(INTRO_MS + 61_100)
    expect(result.current.liveMessage).toBe('New personal best!')
    act(() => {
      result.current.endOvertime()
    })
    expect(result.current.liveMessage).toContain('New personal best: 1:01!')
    expect(banked[0]?.points).toBe([POINTS.survived, 3 * POINTS.lifeLeft, POINTS.overtimeSecond, POINTS.personalBest].reduce((sum, points) => sum + Math.round(points * 0.6), 0))
  })

  it('shows the out-of-rounds banner for a moment when the last special round is fired', async () => {
    const { deps, items, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(loadoutFor('starter_blaster', 'armor_piercing', ['armor_piercing']), 0, 1, 0)
    })
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 60_000))
    })
    await scheduler.advance(INTRO_MS + 20)
    expect(result.current.outOfRounds).toBe(false)
    act(() => {
      result.current.shoot(null, { aim: null, blockedBy: null, via: 'button' })
    })
    expect(result.current.state?.ammo).toBe(0)
    expect(result.current.outOfRounds).toBe(true)
    expect(result.current.liveMessage).toContain('Out of special rounds')
    await scheduler.advance(OUT_OF_ROUNDS_MS + 20)
    expect(result.current.outOfRounds).toBe(false)
  })

  it("I don't know: shows the answer, records a miss right away, and lists the fact to practice", async () => {
    const { deps, items, attempts, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0, 0)
    })
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 60_000))
    })
    await act(async () => {
      items[1]?.resolve(hordeItem(1, 60_000))
    })
    await scheduler.advance(INTRO_MS + 20)
    act(() => {
      result.current.dontKnow()
    })
    expect(result.current.state?.questionRevealed).toBe(true)
    expect(result.current.liveMessage).toBe(`The answer is 3 + 4 = ${String(rightAnswer(0))}. Zap that zombie to keep going.`)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.telemetry.correct).toBe(false)
    const state = result.current.state
    const right = state?.zombies.find((z) => state.answers[z.slot]?.correct === true)
    act(() => {
      result.current.shoot({ zombieId: right?.id ?? '', zone: 'body' }, { aim: null, blockedBy: null, via: 'button' })
    })
    // Solving it now moves on, without recording it again or counting it as solved.
    expect(attempts).toHaveLength(1)
    expect(result.current.solved).toEqual([])
    expect(result.current.missed.map((fact) => fact.summary)).toEqual([`3 + 4 = ${String(rightAnswer(0))}`])
    await scheduler.advance(NEXT_QUESTION_MS + 20)
    expect(result.current.state?.question?.text).toBe('3 + 6 =')
    expect(result.current.state?.questionRevealed).toBe(false)
  })

  it('shows the earned-a-push-back banner for a moment after every third right answer', async () => {
    const { deps, items, attempts, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0, 0)
    })
    // Every question asked for arrives straight away.
    async function answerItems(): Promise<void> {
      await act(async () => {
        items.forEach((item, i) => {
          item.resolve(hordeItem(i, 60_000))
        })
      })
    }
    await answerItems()
    await answerItems()
    await scheduler.advance(INTRO_MS + 20)
    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        expect(result.current.shoveEarned).toBe(false)
        await scheduler.advance(NEXT_QUESTION_MS + 120)
        await answerItems()
      }
      const state = result.current.state
      const right = state?.zombies.find((z) => state.answers[z.slot]?.correct === true)
      act(() => {
        result.current.shoot({ zombieId: right?.id ?? '', zone: 'body' }, { aim: null, blockedBy: null, via: 'button' })
      })
    }
    expect(attempts.map((attempt) => attempt.telemetry.correct)).toEqual([true, true, true])
    expect(result.current.state?.shoves).toBe(2)
    expect(result.current.shoveEarned).toBe(true)
    expect(result.current.liveMessage).toContain('You earned a push-back!')
    await scheduler.advance(SHOVE_EARNED_MS + 20)
    expect(result.current.shoveEarned).toBe(false)
  })
})
