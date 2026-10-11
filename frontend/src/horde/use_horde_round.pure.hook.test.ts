import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import { recordingAudio, virtualScheduler } from '@app/outbreak/arena_fakes.test.ui.tsx'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { STARTER_LOADOUT } from './horde_armory.pure.lib.ts'
import { hordeItem, rightAnswer } from './horde_fakes.test.ui.tsx'
import { INTRO_MS, NEXT_QUESTION_MS, useHordeRound, type HordeRoundDeps } from './use_horde_round.pure.hook.ts'

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
  const scheduler = virtualScheduler()
  const deps: HordeRoundDeps = {
    nextItem: () => {
      const d = deferred<ItemRecord>()
      items.push(d)
      return d.promise
    },
    recordAttempt: () => Promise.resolve(),
    bankRound: () => {
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
  }
  return { deps, items, banks, scheduler }
}

describe('useHordeRound', () => {
  it('loads the first question, fetches the next one ahead, and plays after the intro', async () => {
    const { deps, items, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0)
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
      result.current.start(STARTER_LOADOUT, 1, 0)
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
      result.current.shoot({ zombieId: right?.id ?? '', zone: 'body' })
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
      result.current.start(STARTER_LOADOUT, 1, 0)
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
      result.current.start(STARTER_LOADOUT, 1, 0)
    })
    unmount()
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 60_000))
    })
    expect(result.current.phase).toBe('loading')
  })

  // Plays a whole 60-second round frame by frame on the virtual clock.
  it("says so when the round's points can't be banked", { timeout: 30_000 }, async () => {
    const { deps, items, banks, scheduler } = controlled()
    const { result } = renderHook(() => useHordeRound(deps, 1))
    act(() => {
      result.current.start(STARTER_LOADOUT, 1, 0)
    })
    await act(async () => {
      items[0]?.resolve(hordeItem(0, 600_000))
    })
    await scheduler.advance(INTRO_MS + 60_100)
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
      result.current.start(STARTER_LOADOUT, 0, 0)
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
})
