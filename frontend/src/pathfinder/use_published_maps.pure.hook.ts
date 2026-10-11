import { useEffect, useState } from 'react'
import type { ListPublishedMaps, PublishedMapRecord, SubscribeToFocus } from './pathfinder_state.pure.lib.ts'

export interface PublishedMaps {
  /** Null until the first load succeeds. */
  readonly records: readonly PublishedMapRecord[] | null
  /** Set when the latest load failed; earlier records stay on screen. */
  readonly failed: boolean
}

/**
 * Every published map, loaded on mount and re-loaded whenever the window
 * regains focus, so a map that gets unpublished simply disappears. A failed
 * reload keeps the last list and flags the failure. Nothing lands after
 * unmount.
 */
export function usePublishedMaps(listPublishedMaps: ListPublishedMaps, subscribeToFocus: SubscribeToFocus): PublishedMaps {
  const [state, setState] = useState<PublishedMaps>({ records: null, failed: false })
  useEffect(() => {
    let current = true
    function load(): void {
      listPublishedMaps().then(
        (records) => {
          if (current) setState({ records, failed: false })
        },
        () => {
          if (current) setState((prev) => ({ ...prev, failed: true }))
        },
      )
    }
    load()
    const unsubscribe = subscribeToFocus(load)
    return () => {
      current = false
      unsubscribe()
    }
  }, [listPublishedMaps, subscribeToFocus])
  return state
}
