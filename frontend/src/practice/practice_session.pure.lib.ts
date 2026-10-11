/**
 * A practice session (PRD "Session flow"): start → a set number of items →
 * (games with handwriting: paper handoff → parent verify) → wrap-up with an
 * optional rating. Pure snapshot-in/snapshot-out; use_practice_session drives it.
 */

export type PracticePhase = 'start' | 'playing' | 'handoff' | 'verify' | 'complete'

export interface PracticeSession {
  /** New per session (mount, or "Play again"), so the server can avoid repeating an item within it. */
  readonly sessionId: string
  readonly phase: PracticePhase
  /** Labels of the items answered correctly, in order (words built, equations solved). */
  readonly completed: readonly string[]
  /**
   * Items already counted. Guards a double-submit of the same item, rather than
   * deduping by label: a small pool can legitimately repeat a word later in a
   * session, and that repeat still counts.
   */
  readonly countedItemIds: readonly string[]
  /** The last item's label and recorded attempt, carried through handoff and verify. */
  readonly finalLabel: string | null
  readonly finalAttemptId: number | null
  readonly ratingHandled: boolean
}

export function newSession(sessionId: string): PracticeSession {
  return { sessionId, phase: 'start', completed: [], countedItemIds: [], finalLabel: null, finalAttemptId: null, ratingHandled: false }
}

export function startPlaying(session: PracticeSession): PracticeSession {
  return { ...session, phase: 'playing' }
}

/** Counts a correct answer once per item. `completesSession` is true when this answer fills the session. */
export function countAnswer(session: PracticeSession, itemId: string, label: string, correct: boolean, sessionLength: number): { readonly session: PracticeSession; readonly completesSession: boolean } {
  if (!correct || session.countedItemIds.includes(itemId)) return { session, completesSession: false }
  const completed = [...session.completed, label]
  return { session: { ...session, completed, countedItemIds: [...session.countedItemIds, itemId] }, completesSession: completed.length >= sessionLength }
}

/** After the last item: to the paper handoff (handwriting games) or straight to the wrap-up. */
export function finishItems(session: PracticeSession, label: string, attemptId: number, handoff: boolean): PracticeSession {
  return { ...session, phase: handoff ? 'handoff' : 'complete', finalLabel: label, finalAttemptId: attemptId }
}

export function wroteIt(session: PracticeSession): PracticeSession {
  return session.phase === 'handoff' ? { ...session, phase: 'verify' } : session
}

export function verified(session: PracticeSession): PracticeSession {
  return { ...session, phase: 'complete' }
}

export function ratingDone(session: PracticeSession): PracticeSession {
  return { ...session, ratingHandled: true }
}
