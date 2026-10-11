import { useCallback, useEffect, useRef, useState } from 'react'
import type { AttemptRecord } from '@app/api/practice_schema.pure.lib.ts'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import type { TileResult } from '@app/tiles/tile_placement.pure.lib.ts'
import { countAnswer, finishItems, newSession, ratingDone, startPlaying, verified, wroteIt, type PracticeSession } from './practice_session.pure.lib.ts'
import { PAUSE_BEFORE_WRAP_UP_MS, type PracticeConfig, type PracticeDeps, type PracticeItem } from './practice_state.pure.lib.ts'

export interface PracticeControls<P> {
  readonly session: PracticeSession
  readonly item: PracticeItem<P> | null
  readonly error: string | null
  readonly posting: boolean
  readonly lastAttempt: AttemptRecord | null
  readonly start: () => void
  /** Loads another item in the same session ("Play again" on the tile board). */
  readonly nextItem: () => void
  readonly submit: (result: TileResult) => void
  readonly wroteIt: () => void
  readonly verify: (correct: boolean) => void
  readonly rate: (value: number) => void
  readonly dismissRating: () => void
  /** A fresh session from the start screen. */
  readonly playAgain: () => void
}

/**
 * Drives a practice session: loads an item when play starts (once per
 * session, even under StrictMode's double effects, so the small no-repeat
 * pool isn't spent twice), times and records each attempt, counts correct
 * answers, and moves through handoff/verify/wrap-up. Results never land
 * after unmount. `deps` must be stable (from the game's bind closure).
 */
export function usePracticeSession<P>(deps: PracticeDeps<P>, config: PracticeConfig<P>, profileId: number): PracticeControls<P> {
  const [session, setSession] = useState<PracticeSession>(() => newSession(deps.createId()))
  const [item, setItem] = useState<PracticeItem<P> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [lastAttempt, setLastAttempt] = useState<AttemptRecord | null>(null)
  const startedAt = useRef(0)
  const loadedForSession = useRef<string | null>(null)
  const mounted = useRef(true)
  // Read through a function so the check is fresh after each await.
  const isMounted = (): boolean => mounted.current

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(
    (sessionId: string): void => {
      setError(null)
      setLastAttempt(null)
      deps.loadItem(profileId, sessionId).then(
        (next) => {
          if (!mounted.current) return
          setItem(next)
          startedAt.current = deps.now()
        },
        (err: unknown) => {
          if (mounted.current) setError(errorMessage(err))
        },
      )
    },
    [deps, profileId],
  )

  const playing = session.phase === 'playing'
  const { sessionId } = session
  useEffect(() => {
    if (!playing || loadedForSession.current === sessionId) return
    loadedForSession.current = sessionId
    load(sessionId)
  }, [playing, sessionId, load])

  async function submitAsync(result: TileResult, current: PracticeItem<P>): Promise<void> {
    const label = config.label(current.payload)
    const counted = countAnswer(session, current.itemId, label, result.correct, config.sessionLength)
    setSession(counted.session)
    setPosting(true)
    setError(null)
    try {
      const attempt = await deps.recordAttempt({
        item_id: current.itemId,
        profile_id: profileId,
        game_id: current.gameId,
        session_id: session.sessionId,
        telemetry: { correct: result.correct, hints_used: result.hintsUsed, time_ms: Math.round(deps.now() - startedAt.current) },
        details: config.details(current.payload, result.placement),
      })
      if (!isMounted()) return
      setLastAttempt(attempt)
      if (counted.completesSession) {
        await deps.wait(PAUSE_BEFORE_WRAP_UP_MS)
        if (isMounted()) setSession((s) => finishItems(s, label, attempt.id, config.handoff))
      }
    } catch (err) {
      if (isMounted()) setError(errorMessage(err))
    } finally {
      if (isMounted()) setPosting(false)
    }
  }

  function report(promise: Promise<void>): void {
    promise.catch((err: unknown) => {
      if (isMounted()) setError(errorMessage(err))
    })
  }

  return {
    session,
    item,
    error,
    posting,
    lastAttempt,
    start: () => {
      setSession(startPlaying)
    },
    nextItem: () => {
      load(session.sessionId)
    },
    submit: (result) => {
      if (item !== null) void submitAsync(result, item)
    },
    wroteIt: () => {
      setSession(wroteIt)
    },
    verify: (correct) => {
      if (session.finalAttemptId === null) return
      setSession(verified)
      report(deps.verify(session.finalAttemptId, correct))
    },
    rate: (value) => {
      setSession(ratingDone)
      report(deps.rate(profileId, value))
    },
    dismissRating: () => {
      setSession(ratingDone)
    },
    playAgain: () => {
      setItem(null)
      setSession(newSession(deps.createId()))
    },
  }
}
