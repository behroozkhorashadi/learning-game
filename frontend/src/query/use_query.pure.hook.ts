import { useEffect, useState } from 'react'
import { LOADING, errorMessage, failed, loaded, type QueryState } from './query_state.pure.lib.ts'

/**
 * The server-state seam: runs `load` when the component mounts and tracks it
 * as loading → loaded | failed. `load` is an injected capability (an API
 * adapter method), so this hook needs no DI of its own.
 *
 * - A result never lands on an unmounted component (or a superseded `load`).
 * - `load` must be stable — take it from a bind* closure, never an inline arrow.
 * - Server data stays here, owned by the query; don't copy it into another useState.
 *
 * Caching and refetching would live here too; nothing needs them yet.
 */
export function useQuery<T>(load: () => Promise<T>): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>(LOADING)
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
  }, [load])
  return state
}
