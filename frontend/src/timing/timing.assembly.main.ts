import type { Timers } from './timing_state.pure.lib.ts'

/** The browser's timers. */
export function assembleTimers(): Timers {
  return {
    after: (ms, fn) => {
      const id = setTimeout(fn, ms)
      return () => {
        clearTimeout(id)
      }
    },
    every: (ms, fn) => {
      const id = setInterval(fn, ms)
      return () => {
        clearInterval(id)
      }
    },
  }
}
