import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { factItem, recordingAudio, virtualScheduler } from './arena_fakes.test.ui.tsx'
import { bindFactFluencyBrain } from './fact_fluency_brain.effect.lib.ts'
import { useArenaSession, type ArenaSessionDeps } from './use_arena_session.pure.hook.ts'

/** The session state machine on its own; the screen's suites drive it through the UI. */

function deferredItems() {
  const pending: ((item: ItemRecord) => void)[] = []
  const nextItem: ArenaSessionDeps['nextItem'] = () =>
    new Promise((resolve) => {
      pending.push(resolve)
    })
  return { nextItem, resolve: (n: number, item: ItemRecord) => act(async () => pending[n]?.(item)) }
}

function deps(nextItem: ArenaSessionDeps['nextItem']): ArenaSessionDeps & { readonly scheduler: ReturnType<typeof virtualScheduler> } {
  let sessions = 0
  return {
    brain: bindFactFluencyBrain({ recordAttempt: () => Promise.resolve(), reportError: () => undefined }),
    weapon: STARTER_BLASTER,
    nextItem,
    submitRating: () => Promise.resolve(),
    scheduler: virtualScheduler(),
    audio: recordingAudio(),
    roster: { pickForSession: () => ZOMBIE_CHARACTER_REGISTRY.slice(0, 4), shuffleLanes: (r) => r },
    createSessionId: () => `s${String(++sessions)}`,
  }
}

describe('useArenaSession', () => {
  it('start → intro once the question arrives → playing after the intro beat, with a fresh wave', async () => {
    const items = deferredItems()
    const d = deps(items.nextItem)
    const { result } = renderHook(() => useArenaSession(d, 1))
    expect(result.current.phase).toBe('start')
    act(() => {
      result.current.start()
    })
    expect(result.current.phase).toBe('playing')
    expect(result.current.question).toBeNull()
    await items.resolve(0, factItem(0))
    expect(result.current.phase).toBe('intro')
    expect(result.current.question?.text).toBe('3 + 4 =')
    await d.scheduler.advance(1200)
    expect(result.current.phase).toBe('playing')
    expect(result.current.wave?.carriers).toHaveLength(4)
    expect(result.current.waveCharacters).toHaveLength(4)
  })

  it('drops a question that arrives after the session was restarted', async () => {
    const items = deferredItems()
    const d = deps(items.nextItem)
    const { result } = renderHook(() => useArenaSession(d, 1))
    act(() => {
      result.current.start()
    })
    act(() => {
      result.current.playAgain()
    })
    await items.resolve(0, factItem(4))
    expect(result.current.question).toBeNull()
    await items.resolve(1, factItem(0))
    expect(result.current.question?.text).toBe('3 + 4 =')
  })

  it('shows an unreadable item as an error instead of a question', async () => {
    const items = deferredItems()
    const d = deps(items.nextItem)
    const { result } = renderHook(() => useArenaSession(d, 1))
    act(() => {
      result.current.start()
    })
    await items.resolve(0, { ...factItem(0), payload: { nope: true } })
    expect(result.current.error).toContain("isn't a fact-fluency question")
    expect(result.current.question).toBeNull()
  })

  it('ignores a touch for aiming (no hover crosshair on touch screens)', () => {
    const { result } = renderHook(() => useArenaSession(deps(() => new Promise(() => undefined)), 1))
    const element = document.createElement('div')
    act(() => {
      result.current.aim({ pointerType: 'touch', clientX: 1, clientY: 1, currentTarget: element })
    })
    expect(result.current.aimNdc).toBeNull()
  })

  it('reports a scene that failed to load as an error', () => {
    const { result } = renderHook(() => useArenaSession(deps(() => new Promise(() => undefined)), 1))
    act(() => {
      result.current.sceneFailed(new Error('model 404'))
    })
    expect(result.current.error).toBe("The 3D scene couldn't load: model 404")
  })
})
