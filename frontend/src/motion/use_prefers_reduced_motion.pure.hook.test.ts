import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePrefersReducedMotion, type MotionPreference } from './use_prefers_reduced_motion.pure.hook.ts'

/** A preference the test flips, telling subscribers like the browser would. */
function switchablePreference(initial: boolean) {
  let reduced = initial
  const listeners = new Set<() => void>()
  const preference: MotionPreference = {
    prefersReduced: () => reduced,
    subscribe: (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
  }
  return {
    preference,
    listeners,
    set: (value: boolean) => {
      reduced = value
      for (const listener of listeners) listener()
    },
  }
}

describe('usePrefersReducedMotion', () => {
  it('reads the preference and follows changes live', () => {
    const { preference, set } = switchablePreference(false)
    const { result } = renderHook(() => usePrefersReducedMotion(preference))
    expect(result.current).toBe(false)
    act(() => {
      set(true)
    })
    expect(result.current).toBe(true)
  })

  it('unsubscribes on unmount', () => {
    const { preference, listeners } = switchablePreference(true)
    const { unmount } = renderHook(() => usePrefersReducedMotion(preference))
    expect(listeners.size).toBe(1)
    unmount()
    expect(listeners.size).toBe(0)
  })
})
