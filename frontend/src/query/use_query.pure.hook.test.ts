import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useQuery } from './use_query.pure.hook.ts'

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (v: T) => void; readonly reject: (e: Error) => void } {
  let resolve: (v: T) => void = () => undefined
  let reject: (e: Error) => void = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useQuery', () => {
  it('goes loading → loaded', async () => {
    const d = deferred<string>()
    const load = (): Promise<string> => d.promise
    const { result } = renderHook(() => useQuery(load))
    expect(result.current).toEqual({ kind: 'loading' })
    await act(async () => {
      d.resolve('data')
    })
    expect(result.current).toEqual({ kind: 'loaded', data: 'data' })
  })

  it('goes loading → failed with the message', async () => {
    const d = deferred<string>()
    const load = (): Promise<string> => d.promise
    const { result } = renderHook(() => useQuery(load))
    await act(async () => {
      d.reject(new Error('HTTP 500'))
    })
    expect(result.current).toEqual({ kind: 'failed', message: 'HTTP 500' })
  })

  it('drops a result that arrives after unmount', async () => {
    const d = deferred<string>()
    const load = (): Promise<string> => d.promise
    const { result, unmount } = renderHook(() => useQuery(load))
    unmount()
    await act(async () => {
      d.resolve('late')
    })
    expect(result.current).toEqual({ kind: 'loading' })
  })
})
