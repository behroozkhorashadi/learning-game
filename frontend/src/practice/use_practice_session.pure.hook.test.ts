import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode, createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { TileResult } from '@app/tiles/tile_placement.pure.lib.ts'
import { fakePractice } from './practice_fakes.test.lib.ts'
import type { PracticeConfig } from './practice_state.pure.lib.ts'
import { usePracticeSession } from './use_practice_session.pure.hook.ts'

const CONFIG: PracticeConfig<string> = { sessionLength: 2, handoff: true, label: (word) => word, details: (_w, placement) => ({ assembled: placement }) }
const RIGHT: TileResult = { kind: 'word', correct: true, placement: ['a'], value: 'a', hintsUsed: 1 }
const WRONG: TileResult = { ...RIGHT, correct: false }

describe('usePracticeSession', () => {
  it('loads one item when play starts, even under StrictMode', async () => {
    const fake = fakePractice('g', ['cat', 'dog'])
    const wrapper = ({ children }: { readonly children: ReactNode }) => createElement(StrictMode, null, children)
    const { result } = renderHook(() => usePracticeSession(fake.deps, CONFIG, 3), { wrapper })
    expect(fake.loadsFor).toEqual([])
    act(() => {
      result.current.start()
    })
    await waitFor(() => {
      expect(result.current.item?.payload).toBe('cat')
    })
    expect(fake.loadsFor).toEqual(['session-1'])
  })

  it('records each attempt with the telemetry core, and moves to the handoff after the last item', async () => {
    const fake = fakePractice('g', ['cat', 'dog'])
    const { result } = renderHook(() => usePracticeSession(fake.deps, CONFIG, 3))
    act(() => {
      result.current.start()
    })
    await waitFor(() => {
      expect(result.current.item).not.toBeNull()
    })
    act(() => {
      result.current.submit(WRONG)
    })
    await waitFor(() => {
      expect(result.current.lastAttempt?.id).toBe(1)
    })
    act(() => {
      result.current.submit(RIGHT)
    })
    await waitFor(() => {
      expect(fake.attempts).toHaveLength(2)
    })
    expect(fake.attempts[1]).toEqual({ item_id: 'item-1', profile_id: 3, game_id: 'g', session_id: 'session-1', telemetry: { correct: true, hints_used: 1, time_ms: 2000 }, details: { assembled: ['a'] } })
    expect(result.current.session.completed).toEqual(['cat'])

    act(() => {
      result.current.nextItem()
    })
    await waitFor(() => {
      expect(result.current.item?.payload).toBe('dog')
    })
    act(() => {
      result.current.submit(RIGHT)
    })
    await waitFor(() => {
      expect(result.current.session.phase).toBe('handoff')
    })
    expect([result.current.session.finalLabel, result.current.session.finalAttemptId]).toEqual(['dog', 3])

    act(() => {
      result.current.wroteIt()
    })
    act(() => {
      result.current.verify(true)
    })
    expect(result.current.session.phase).toBe('complete')
    await waitFor(() => {
      expect(fake.verifications).toEqual([{ attemptId: 3, correct: true }])
    })
    act(() => {
      result.current.rate(5)
    })
    expect(result.current.session.ratingHandled).toBe(true)
    await waitFor(() => {
      expect(fake.ratings).toEqual([5])
    })
  })

  it('goes straight to the wrap-up for a game without handwriting', async () => {
    const fake = fakePractice('g', ['x'])
    const { result } = renderHook(() => usePracticeSession(fake.deps, { ...CONFIG, sessionLength: 1, handoff: false }, 3))
    act(() => {
      result.current.start()
    })
    await waitFor(() => {
      expect(result.current.item).not.toBeNull()
    })
    act(() => {
      result.current.submit(RIGHT)
    })
    await waitFor(() => {
      expect(result.current.session.phase).toBe('complete')
    })
  })

  it('shows load and attempt failures', async () => {
    const failingLoad = fakePractice('g', ['x'], { failLoad: 'GET /api/items/next failed with HTTP 500' })
    const load = renderHook(() => usePracticeSession(failingLoad.deps, CONFIG, 3))
    act(() => {
      load.result.current.start()
    })
    await waitFor(() => {
      expect(load.result.current.error).toBe('GET /api/items/next failed with HTTP 500')
    })

    const failingAttempt = fakePractice('g', ['x'], { failAttempt: 'POST /api/attempts failed with HTTP 500' })
    const attempt = renderHook(() => usePracticeSession(failingAttempt.deps, CONFIG, 3))
    act(() => {
      attempt.result.current.start()
    })
    await waitFor(() => {
      expect(attempt.result.current.item).not.toBeNull()
    })
    act(() => {
      attempt.result.current.submit(RIGHT)
    })
    await waitFor(() => {
      expect(attempt.result.current.error).toBe('POST /api/attempts failed with HTTP 500')
    })
    expect(attempt.result.current.posting).toBe(false)
  })

  it('"Play again" starts a fresh session with a new id', async () => {
    const fake = fakePractice('g', ['x'])
    const { result } = renderHook(() => usePracticeSession(fake.deps, CONFIG, 3))
    act(() => {
      result.current.playAgain()
    })
    expect(result.current.session).toMatchObject({ sessionId: 'session-2', phase: 'start', completed: [] })
    act(() => {
      result.current.start()
    })
    await waitFor(() => {
      expect(fake.loadsFor).toEqual(['session-2'])
    })
  })
})
