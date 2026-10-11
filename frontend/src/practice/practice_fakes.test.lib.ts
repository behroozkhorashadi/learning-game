import type { AttemptBody, AttemptRecord } from '@app/api/practice_schema.pure.lib.ts'
import type { PracticeDeps } from './practice_state.pure.lib.ts'

export interface FakePractice<P> {
  readonly deps: PracticeDeps<P>
  readonly attempts: readonly AttemptBody[]
  readonly ratings: readonly number[]
  readonly verifications: readonly { readonly attemptId: number; readonly correct: boolean }[]
  /** Session ids items were requested for. */
  readonly loadsFor: readonly string[]
}

/**
 * An in-memory practice loop: serves `payloads` in order (one item each),
 * records every attempt, rating, and verification, and a clock that ticks
 * 1000 ms per read. `wait` resolves at once, so the wrap-up pause doesn't
 * slow tests. `failLoad`/`failAttempt` make those calls reject.
 */
export function fakePractice<P>(gameId: string, payloads: readonly P[], options: { readonly failLoad?: string; readonly failAttempt?: string } = {}): FakePractice<P> {
  const attempts: AttemptBody[] = []
  const ratings: number[] = []
  const verifications: { attemptId: number; correct: boolean }[] = []
  const loadsFor: string[] = []
  let served = 0
  let ids = 0
  let clock = 0
  const deps: PracticeDeps<P> = {
    loadItem: (_profileId, sessionId) => {
      loadsFor.push(sessionId)
      if (options.failLoad !== undefined) return Promise.reject(new Error(options.failLoad))
      const payload = payloads[served % payloads.length]
      if (payload === undefined) return Promise.reject(new Error('fakePractice has no payloads'))
      served += 1
      return Promise.resolve({ itemId: `item-${String(served)}`, gameId, payload })
    },
    recordAttempt: (attempt) => {
      attempts.push(attempt)
      if (options.failAttempt !== undefined) return Promise.reject(new Error(options.failAttempt))
      const record: AttemptRecord = { id: attempts.length, event_id: `evt-${String(attempts.length).padStart(8, '0')}`, correct: attempt.telemetry.correct ?? null, score: null, hints_used: attempt.telemetry.hints_used, hint_offered: false, time_ms: attempt.telemetry.time_ms }
      return Promise.resolve(record)
    },
    rate: (_profileId, value) => {
      ratings.push(value)
      return Promise.resolve()
    },
    verify: (attemptId, correct) => {
      verifications.push({ attemptId, correct })
      return Promise.resolve()
    },
    createId: () => {
      ids += 1
      return `session-${String(ids)}`
    },
    now: () => {
      clock += 1000
      return clock
    },
    wait: () => Promise.resolve(),
  }
  return { deps, attempts, ratings, verifications, loadsFor }
}
