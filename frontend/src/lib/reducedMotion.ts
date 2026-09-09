import { useEffect, useState } from 'react'

/** Tracks `prefers-reduced-motion`, live — used to dial back screen shake,
 * weapon sway, and other purely-decorative motion without touching gameplay
 * timing or information (per the accessibility requirement that reduced
 * motion changes *effects*, never game state or pacing). */
function safeMatchMedia(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  try {
    // Some test/jsdom environments expose `matchMedia` as a callable stub
    // that doesn't return a real MediaQueryList — guard against that rather
    // than assuming a spec-compliant browser implementation.
    return window.matchMedia(query) ?? null
  } catch {
    return null
  }
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => safeMatchMedia('(prefers-reduced-motion: reduce)')?.matches ?? false)

  useEffect(() => {
    const mql = safeMatchMedia('(prefers-reduced-motion: reduce)')
    if (!mql) return
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return reduced
}
