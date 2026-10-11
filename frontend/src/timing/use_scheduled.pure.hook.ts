import { useEffect, useRef } from 'react'
import type { Timers } from './timing_state.pure.lib.ts'

export interface Scheduled {
  /** Like `timers.after`, but cancelled by `cancelAll()` and on unmount. */
  readonly after: (ms: number, fn: () => void) => void
  readonly every: (ms: number, fn: () => void) => void
  readonly cancelAll: () => void
}

/** Component-scoped timers: nothing scheduled here ever fires after unmount. */
export function useScheduled(timers: Timers): Scheduled {
  const cancels = useRef<(() => void)[]>([])
  const cancelAll = (): void => {
    for (const cancel of cancels.current) cancel()
    cancels.current = []
  }
  useEffect(
    () => () => {
      for (const cancel of cancels.current) cancel()
      cancels.current = []
    },
    [],
  )
  return {
    after: (ms, fn) => {
      cancels.current.push(timers.after(ms, fn))
    },
    every: (ms, fn) => {
      cancels.current.push(timers.every(ms, fn))
    },
    cancelAll,
  }
}
