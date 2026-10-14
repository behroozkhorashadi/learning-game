import { useEffect, useState } from 'react'
import type { Timers } from '@app/timing/timing_state.pure.lib.ts'

/**
 * Loads now and then every `everyMs` while mounted and `keepPolling` says so;
 * returns the newest result, or null before the first one lands. `keepPolling`
 * sees that newest result, so polling can stop once it brings what it was for. A load that fails keeps the last result (the
 * next poll tries again), an older load that settles late never replaces a newer
 * one, and nothing lands after unmount.
 *
 * `load` must be stable: take it from a bind* closure or a useState initializer.
 */
export function usePolled<T>(load: () => Promise<T>, timers: Timers, everyMs: number, keepPolling: (latest: T | null) => boolean = () => true): T | null {
  const [latest, setLatest] = useState<T | null>(null)
  const enabled = keepPolling(latest)
  useEffect(() => {
    if (!enabled) return undefined
    let mounted = true
    let started = 0
    let landed = 0
    const poll = (): void => {
      started += 1
      const ticket = started
      load().then(
        (data) => {
          if (!mounted || ticket < landed) return
          landed = ticket
          setLatest(data)
        },
        () => undefined, // keep the last result; the next poll tries again
      )
    }
    poll()
    const cancel = timers.every(everyMs, poll)
    return () => {
      mounted = false
      cancel()
    }
  }, [load, timers, everyMs, enabled])
  return latest
}
