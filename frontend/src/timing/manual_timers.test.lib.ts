import type { Timers } from './timing_state.pure.lib.ts'

export interface ManualTimers extends Timers {
  /** Moves the clock forward, firing whatever comes due, in order. */
  readonly advance: (ms: number) => void
  readonly pending: () => number
}

/** A clock that only moves when the test says. */
export function manualTimers(): ManualTimers {
  let now = 0
  let nextId = 0
  const jobs = new Map<number, { due: number; every: number | null; fn: () => void }>()
  const schedule = (ms: number, fn: () => void, repeat: boolean): (() => void) => {
    nextId += 1
    const id = nextId
    jobs.set(id, { due: now + ms, every: repeat ? ms : null, fn })
    return () => {
      jobs.delete(id)
    }
  }
  return {
    after: (ms, fn) => schedule(ms, fn, false),
    every: (ms, fn) => schedule(ms, fn, true),
    advance: (ms) => {
      const end = now + ms
      for (;;) {
        const due = [...jobs.entries()].filter(([, j]) => j.due <= end).sort(([, a], [, b]) => a.due - b.due)[0]
        if (due === undefined) break
        const [id, job] = due
        now = job.due
        if (job.every === null) jobs.delete(id)
        else job.due += job.every
        job.fn()
      }
      now = end
    },
    pending: () => jobs.size,
  }
}

/** Timers that fire immediately (`after`) and never repeat (`every`): for stories and tests that don't care about time. */
export const INSTANT_TIMERS: Timers = {
  after: (_ms, fn) => {
    queueMicrotask(fn)
    return () => undefined
  },
  every: () => () => undefined,
}
