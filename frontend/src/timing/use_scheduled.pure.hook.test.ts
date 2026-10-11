import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { manualTimers } from './manual_timers.test.lib.ts'
import { useScheduled } from './use_scheduled.pure.hook.ts'

describe('useScheduled', () => {
  it('useScheduled cancels everything on cancelAll and on unmount', () => {
    const timers = manualTimers()
    const fired: string[] = []
    const { result, unmount } = renderHook(() => useScheduled(timers))
    act(() => {
      result.current.after(100, () => fired.push('a'))
      result.current.every(50, () => fired.push('tick'))
    })
    timers.advance(100)
    expect(fired).toEqual(['tick', 'a', 'tick'])
    act(() => {
      result.current.cancelAll()
      result.current.after(10, () => fired.push('late'))
    })
    unmount()
    timers.advance(1000)
    expect(fired).toEqual(['tick', 'a', 'tick'])
    expect(timers.pending()).toBe(0)
  })

})
