import type { AttemptBody, AttemptRecord } from '@app/api/practice_schema.pure.lib.ts'

/** One item, with its game-specific payload already parsed. */
export interface PracticeItem<P> {
  readonly itemId: string
  readonly gameId: string
  readonly payload: P
}

/** What a practice game needs from the world. Built once in the game's bind*. */
export interface PracticeDeps<P> {
  /** The next item for this session, parsed. In the app: the practice adapter's nextItem + the game's payload parser. */
  readonly loadItem: (profileId: number, sessionId: string) => Promise<PracticeItem<P>>
  readonly recordAttempt: (attempt: AttemptBody) => Promise<AttemptRecord>
  readonly rate: (profileId: number, value: number) => Promise<void>
  readonly verify: (attemptId: number, correct: boolean) => Promise<void>
  readonly createId: () => string
  /** A monotonic clock in ms (performance.now), for time_ms. */
  readonly now: () => number
  /** Resolves after `ms`, for the pause that lets "You built it!" show before the wrap-up. */
  readonly wait: (ms: number) => Promise<void>
}

/** How one game plays the session. */
export interface PracticeConfig<P> {
  readonly sessionLength: number
  /** Handwriting games end with a paper handoff and parent verify. */
  readonly handoff: boolean
  /** How a correctly answered item is listed at the wrap-up ('rabbit', '3 + 4 = 7'). */
  readonly label: (payload: P) => string
  /** The game's own attempt `details` (placement, which part was missing, …). */
  readonly details: (payload: P, placement: readonly (string | null)[]) => Readonly<Record<string, unknown>>
}

export const PAUSE_BEFORE_WRAP_UP_MS = 900
