import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePathfinderServer } from './pathfinder_fakes.test.lib.ts'
import type { LevelProgressStore } from './pathfinder_state.pure.lib.ts'
import { useLevelProgress } from './use_level_progress.pure.hook.ts'

/** A store whose list call settles only when the test says. */
function deferredStore(): { readonly store: LevelProgressStore; readonly resolve: (ids: ReadonlySet<string>) => Promise<void> } {
  let settle: (ids: ReadonlySet<string>) => void = () => undefined
  const store: LevelProgressStore = {
    listCompletions: () =>
      new Promise((resolve) => {
        settle = resolve
      }),
    addCompletion: () => Promise.resolve(new Set()),
  }
  return {
    store,
    resolve: (ids) =>
      act(async () => {
        settle(ids)
      }),
  }
}

describe('useLevelProgress', () => {
  it('goes loading → ready with the stored completions', async () => {
    const server = fakePathfinderServer()
    server.completions.set(1, ['a'])
    const { result } = renderHook(() => useLevelProgress(server, 1))
    expect(result.current.status).toBe('loading')
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(result.current.completedIds).toEqual(new Set(['a']))
  })

  it('reports an error when the load fails', async () => {
    const server = fakePathfinderServer()
    server.failing = true
    const { result } = renderHook(() => useLevelProgress(server, 1))
    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })

  it('records a completion optimistically, then takes the server answer', async () => {
    const server = fakePathfinderServer()
    server.completions.set(1, ['old'])
    const { result } = renderHook(() => useLevelProgress(server, 1))
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    act(() => {
      result.current.recordCompletion('new')
    })
    expect(result.current.completedIds).toEqual(new Set(['old', 'new']))
    await waitFor(() => {
      expect(server.completions.get(1)).toEqual(['old', 'new'])
    })
    expect(result.current.saveFailed).toBe(false)
  })

  it('keeps the optimistic unlock but flags a failed save', async () => {
    const server = fakePathfinderServer()
    const { result } = renderHook(() => useLevelProgress(server, 1))
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    server.failing = true
    act(() => {
      result.current.recordCompletion('a')
    })
    await waitFor(() => {
      expect(result.current.saveFailed).toBe(true)
    })
    expect(result.current.completedIds).toEqual(new Set(['a']))
  })

  it("a different profile starts loading afresh, and the old profile's late result never lands", async () => {
    const first = deferredStore()
    const { result, rerender } = renderHook(({ profileId }) => useLevelProgress(first.store, profileId), { initialProps: { profileId: 1 } })
    rerender({ profileId: 2 })
    expect(result.current.status).toBe('loading')
    await first.resolve(new Set(['from-profile-2']))
    expect(result.current.completedIds).toEqual(new Set(['from-profile-2']))
  })

  it('drops a result that arrives after unmount', async () => {
    const deferred = deferredStore()
    const { result, unmount } = renderHook(() => useLevelProgress(deferred.store, 1))
    unmount()
    await deferred.resolve(new Set(['late']))
    expect(result.current.status).toBe('loading')
  })
})
