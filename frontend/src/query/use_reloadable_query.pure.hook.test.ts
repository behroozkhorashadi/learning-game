import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useReloadableQuery } from './use_reloadable_query.pure.hook.ts'

/** A load whose nth call settles when the test says. */
function scriptedLoad() {
  const pending: { resolve: (v: string) => void; reject: (e: Error) => void }[] = []
  const load = (): Promise<string> =>
    new Promise((resolve, reject) => {
      pending.push({ resolve, reject })
    })
  const settle = (n: number, outcome: string | Error) =>
    act(async () => {
      const call = pending[n]
      if (call === undefined) throw new Error(`load call ${String(n)} never happened`)
      if (outcome instanceof Error) call.reject(outcome)
      else call.resolve(outcome)
    })
  return { load, settle, calls: () => pending.length }
}

describe('useReloadableQuery', () => {
  it('loads, then keeps the old data on screen while a reload runs', async () => {
    const { load, settle, calls } = scriptedLoad()
    const { result } = renderHook(() => useReloadableQuery(load))
    expect(result.current.state).toEqual({ kind: 'loading' })
    await settle(0, 'first')
    expect(result.current.state).toEqual({ kind: 'loaded', data: 'first' })

    act(() => {
      result.current.reload()
    })
    expect(calls()).toBe(2)
    expect(result.current.state).toEqual({ kind: 'loaded', data: 'first' })
    await settle(1, 'second')
    expect(result.current.state).toEqual({ kind: 'loaded', data: 'second' })
  })

  it('only the latest run lands', async () => {
    const { load, settle } = scriptedLoad()
    const { result } = renderHook(() => useReloadableQuery(load))
    act(() => {
      result.current.reload()
    })
    await settle(1, 'latest')
    await settle(0, 'stale')
    expect(result.current.state).toEqual({ kind: 'loaded', data: 'latest' })
  })

  it('reports a failed reload', async () => {
    const { load, settle } = scriptedLoad()
    const { result } = renderHook(() => useReloadableQuery(load))
    await settle(0, 'first')
    act(() => {
      result.current.reload()
    })
    await settle(1, new Error('HTTP 500'))
    expect(result.current.state).toEqual({ kind: 'failed', message: 'HTTP 500' })
  })

  it('drops a result that arrives after unmount', async () => {
    const { load, settle } = scriptedLoad()
    const { result, unmount } = renderHook(() => useReloadableQuery(load))
    unmount()
    await settle(0, 'late')
    expect(result.current.state).toEqual({ kind: 'loading' })
  })
})
