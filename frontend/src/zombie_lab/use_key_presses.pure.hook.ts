import { useEffect, useLayoutEffect, useRef } from 'react'

/** Subscribes to page key presses (in the app, `window` keydown); returns the unsubscribe. */
export type KeyPresses = (onKey: (key: string) => void) => () => void

/** Calls the latest `onKey` with each pressed key, lower-cased, for as long as the component is mounted. */
export function useKeyPresses(keys: KeyPresses, onKey: (key: string) => void): void {
  const latest = useRef(onKey)
  useLayoutEffect(() => {
    latest.current = onKey
  })
  useEffect(
    () =>
      keys((key) => {
        latest.current(key.toLowerCase())
      }),
    [keys],
  )
}
