import { useEffect, useRef, useState } from 'react'
import type { LevelProgressStore } from './pathfinder_state.pure.lib.ts'

export interface LevelProgress {
  readonly status: 'loading' | 'ready' | 'error'
  readonly completedIds: ReadonlySet<string>
  /** The last completion couldn't be saved (it still counts for this visit). */
  readonly saveFailed: boolean
  /** Unlocks the next level right away, then saves; the server's answer replaces the local guess. */
  readonly recordCompletion: (levelId: string) => void
}

interface Loaded {
  readonly profileId: number
  readonly status: 'loading' | 'ready' | 'error'
  readonly completedIds: ReadonlySet<string>
}

const EMPTY: ReadonlySet<string> = new Set()

/**
 * A profile's level completions: loaded on mount (and per profile), with
 * an optimistic `recordCompletion`. Results for another profile, or after
 * unmount, never land.
 */
export function useLevelProgress(store: LevelProgressStore, profileId: number): LevelProgress {
  const [stored, setLoaded] = useState<Loaded>({ profileId, status: 'loading', completedIds: EMPTY })
  const loaded = stored.profileId === profileId ? stored : { profileId, status: 'loading' as const, completedIds: EMPTY }
  const [saveFailed, setSaveFailed] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    let current = true
    store.listCompletions(profileId).then(
      (completedIds) => {
        if (current) setLoaded({ profileId, status: 'ready', completedIds })
      },
      () => {
        if (current) setLoaded({ profileId, status: 'error', completedIds: EMPTY })
      },
    )
    return () => {
      current = false
      mounted.current = false
    }
  }, [store, profileId])

  function recordCompletion(levelId: string): void {
    // Unlock the next level right away; if saving fails the unlock still
    // holds for this visit, and the screen says it wasn't saved.
    setLoaded((prev) => (prev.profileId === profileId ? { ...prev, completedIds: new Set(prev.completedIds).add(levelId) } : prev))
    setSaveFailed(false)
    store.addCompletion(profileId, levelId).then(
      (completedIds) => {
        if (mounted.current) setLoaded((prev) => (prev.profileId === profileId ? { ...prev, completedIds } : prev))
      },
      () => {
        if (mounted.current) setSaveFailed(true)
      },
    )
  }

  return { status: loaded.status, completedIds: loaded.completedIds, saveFailed, recordCompletion }
}
