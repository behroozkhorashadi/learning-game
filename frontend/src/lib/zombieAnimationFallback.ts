/**
 * Pure "what clip should actually play" resolution for `ZombieCharacter3D`
 * — factored out so a missing/misnamed animation on some future character
 * can be exercised with plain strings in a test, without a GLTF or a
 * WebGL context. `ZombieCharacter3D` calls this on every clip-role change
 * and only logs/falls back on the result; it never inlines this decision.
 */

export type ZombieClipRole = 'idle' | 'approach' | 'hitReact' | 'deadHeadshot' | 'deadBody' | 'reach'

/** Roles that loop for as long as a carrier stays in that state — a zombie
 * needs *some* continuous motion here, so a missing clip falls back to
 * whatever the GLB actually has rather than freezing mid-approach. */
const LOOPING_ROLES: ZombieClipRole[] = ['idle', 'approach']

export interface AnimationFallbackResult {
  /** The clip name to actually play, or `null` for "play nothing — hold a
   * stationary pose." */
  clipName: string | null
  /** True when `configuredName` wasn't found and a fallback decision was
   * made — callers use this to gate a one-time development warning. */
  usedFallback: boolean
}

/**
 * `configuredName` is what the character's registry entry maps this role
 * to; `availableClipNames` is what the GLB actually embeds. When the
 * configured name is missing:
 *
 * - Looping roles (idle/approach) fall back to the GLB's first embedded
 *   clip — some motion, even if not the intended one, reads better than a
 *   zombie frozen mid-approach.
 * - One-shot roles (hitReact/deadHeadshot/deadBody/reach) fall back to
 *   `null` (a stationary pose) rather than substituting an unrelated
 *   one-shot clip — playing e.g. "Walking" in place of a missing "Dead"
 *   would look broken, whereas freezing reads as an acceptable, if
 *   unpolished, stand-in. This matches the brief: hit reactions "briefly
 *   pause," deaths "freeze," and none of the gameplay consequences
 *   (knockback, defeat, life loss, wave resolution) depend on the
 *   animation actually playing — `zombieWaveEngine`/`ZombieMathBlaster`
 *   drive all of that independently of what's on screen.
 */
export function resolveZombieClip(configuredName: string, role: ZombieClipRole, availableClipNames: readonly string[]): AnimationFallbackResult {
  if (availableClipNames.includes(configuredName)) {
    return { clipName: configuredName, usedFallback: false }
  }

  if (LOOPING_ROLES.includes(role)) {
    return { clipName: availableClipNames[0] ?? null, usedFallback: true }
  }

  return { clipName: null, usedFallback: true }
}
