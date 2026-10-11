import { useEffect, useState } from 'react'
import { LOADING, errorMessage, failed, loaded, type QueryState } from './query_state.pure.lib.ts'

export interface ReloadableQuery<T> {
  readonly state: QueryState<T>
  /** Re-runs `load` (after a mutation). The last data stays on screen until the new result lands. */
  readonly reload: () => void
}

/**
 * `useQuery` plus a reload command, for screens that change server data and
 * then re-read it (edit a row, delete a row). Same rules as useQuery: `load`
 * must be stable; a result never lands after unmount, and only the latest
 * run's result lands.
 */
export function useReloadableQuery<T>(load: () => Promise<T>): ReloadableQuery<T> {
  const [state, setState] = useState<QueryState<T>>(LOADING)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let current = true
    load().then(
      (data) => {
        if (current) setState(loaded(data))
      },
      (error: unknown) => {
        if (current) setState(failed(errorMessage(error)))
      },
    )
    return () => {
      current = false
    }
  }, [load, version])
  return {
    state,
    reload: () => {
      setVersion((v) => v + 1)
    },
  }
}
