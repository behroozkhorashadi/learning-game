/** Timers as a capability: assembly passes the real ones, tests a manual clock. */
export interface Timers {
  /** Runs `fn` once after `ms`. Returns a cancel function. */
  readonly after: (ms: number, fn: () => void) => () => void
  /** Runs `fn` every `ms` until cancelled. */
  readonly every: (ms: number, fn: () => void) => () => void
}

export function waitFor(timers: Timers, ms: number): Promise<void> {
  return new Promise((resolve) => {
    timers.after(ms, resolve)
  })
}
