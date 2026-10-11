import type { MotionPreference } from './use_prefers_reduced_motion.pure.hook.ts'

const QUERY = '(prefers-reduced-motion: reduce)'

/** The OS/browser reduced-motion setting, live, over `matchMedia`. Off where there is none (old browsers, some test environments). */
export function assembleMotionPreference(): MotionPreference {
  // jsdom has no matchMedia, and some stubs return nothing usable or throw: all of those mean "no preference".
  let query: MediaQueryList | null = null
  try {
    if ('matchMedia' in window) query = window.matchMedia(QUERY)
  } catch {
    query = null
  }
  return {
    prefersReduced: () => query?.matches ?? false,
    subscribe: (onChange) => {
      query?.addEventListener('change', onChange)
      return () => {
        query?.removeEventListener('change', onChange)
      }
    },
  }
}
