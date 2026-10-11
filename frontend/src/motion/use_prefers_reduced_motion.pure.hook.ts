import { useSyncExternalStore } from 'react'

/**
 * `prefers-reduced-motion`, live. In the app, motion_preference.assembly.main.ts
 * over `matchMedia`; tests pass a fake.
 */
export interface MotionPreference {
  readonly prefersReduced: () => boolean
  /** Calls `onChange` whenever the preference changes; returns the unsubscribe. */
  readonly subscribe: (onChange: () => void) => () => void
}

/**
 * Whether the player asked for reduced motion. Used to dial back screen
 * shake, weapon sway, and other decorative motion, never gameplay timing or
 * information (reduced motion changes effects, not game state or pacing).
 */
export function usePrefersReducedMotion(preference: MotionPreference): boolean {
  return useSyncExternalStore(preference.subscribe, preference.prefersReduced, preference.prefersReduced)
}
