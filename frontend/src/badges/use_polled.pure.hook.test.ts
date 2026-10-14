import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { manualTimers } from '@app/timing/manual_timers.test.lib.ts'
import { usePolled } from './use_polled.pure.hook.ts'

/** Loads that settle when the test says, in any order. */
function loads(): { readonly load: () => Promise<string>; readonly settle: (index: number, value: string | Error) => Promise<void>; readonly count: () => number } {
  const pending: { resolve: (v: string) => void; reject: (e: Error) => void; promise: Promise<string> }[] = []
  return {
    load: () => {
      let resolve: (v: string) => void = () => undefined
      let reject: (e: Error) => void = () => undefined
      const promise = new Promise<string>((res, rej) => {
        resolve = res
        reject = rej
      })
      pending.push({ resolve, reject, promise })
      return promise
    },
    settle: async (index, value) => {
      const entry = pending[index]
      if (entry === undefined) throw new Error(`no load ${String(index)}`)
      await act(async () => {
        if (value instanceof Error) entry.reject(value)
        else entry.resolve(value)
        await entry.promise.catch(() => undefined)
      })
    },
    count: () => pending.length,
  }
}

describe('usePolled', () => {
  it('loads now and on every tick, keeping the newest result', async () => {
    const timers = manualTimers()
    const { load, settle, count } = loads()
    const { result } = renderHook(() => usePolled(load, timers, 1000))
    expect(result.current).toBeNull()
    await settle(0, 'first')
    expect(result.current).toBe('first')
    act(() => {
      timers.advance(1000)
    })
    expect(count()).toBe(2)
    await settle(1, 'second')
    expect(result.current).toBe('second')
  })

  it('keeps the last result through a failure, and never lets an older load win', async () => {
    const timers = manualTimers()
    const { load, settle } = loads()
    const { result } = renderHook(() => usePolled(load, timers, 1000))
    act(() => {
      timers.advance(2000)
    })
    await settle(2, 'newest')
    await settle(0, 'oldest')
    expect(result.current).toBe('newest')
    await settle(1, new Error('offline'))
    expect(result.current).toBe('newest')
  })

  it('stops polling, and drops late results, after unmount', async () => {
    const timers = manualTimers()
    const { load, settle, count } = loads()
    const { result, unmount } = renderHook(() => usePolled(load, timers, 1000))
    unmount()
    expect(timers.pending()).toBe(0)
    await settle(0, 'late')
    expect(result.current).toBeNull()
    expect(count()).toBe(1)
  })

  it('polls only while keepPolling says so, judging by the newest result', async () => {
    const timers = manualTimers()
    const { load, settle, count } = loads()
    const { result, rerender } = renderHook(({ on }: { readonly on: boolean }) => usePolled(load, timers, 1000, (latest) => on && latest !== 'done'), { initialProps: { on: false } })
    expect([count(), timers.pending()]).toEqual([0, 0])
    rerender({ on: true })
    await settle(0, 'painting')
    expect(timers.pending()).toBe(1)
    act(() => {
      timers.advance(1000)
    })
    await settle(1, 'done')
    expect(result.current).toBe('done')
    expect(timers.pending()).toBe(0)
  })
})
