/**
 * Pure classification of "what did this shot actually hit" — factored out
 * of `EquationOutbreakScene` so the nearest-hit-wins / environment-blocks /
 * debug-is-invisible rules can be unit tested directly, without a WebGL
 * context. The renderer feeds this the raw, unsorted list of everything a
 * raycast intersected (each tagged with a `kind` via `userData` — see
 * `EnvironmentCollider.tsx` and the zombie model meshes in
 * `EquationOutbreakScene.tsx`) and acts on whatever comes back.
 *
 * Three.js/R3F's own nearest-object-first event dispatch already makes an
 * environment collider block a farther zombie in practice (each
 * tagged mesh's handler calls `stopPropagation`, so only the nearest one
 * ever runs) — this function is the second, independently-testable source
 * of truth for that same rule, and is what the real handler actually calls
 * rather than trusting dispatch order alone.
 */

export type RaycastHitKind = 'zombie' | 'environment' | 'debug'

/** One thing a ray passed through. Only a zombie hit carries which carrier and zone it was. */
export type RaycastHit<Meta> =
  | { readonly kind: 'zombie'; readonly distance: number; readonly meta: Meta }
  | { readonly kind: Exclude<RaycastHitKind, 'zombie'>; readonly distance: number }

export type RaycastOutcome<Meta> = { readonly type: 'miss' } | { readonly type: 'blocked' } | { readonly type: 'zombie'; readonly meta: Meta }

/** `hits` need not be pre-sorted or pre-filtered — debug-tagged hits (and
 * anything untagged/unknown) are ignored entirely, regardless of how close
 * they are; among what's left, the nearest wins. */
export function resolveRaycastOutcome<Meta>(hits: readonly RaycastHit<Meta>[]): RaycastOutcome<Meta> {
  let nearest: RaycastHit<Meta> | null = null
  for (const hit of hits) {
    if (hit.kind === 'debug') continue
    if (nearest === null || hit.distance < nearest.distance) nearest = hit
  }
  if (nearest === null) return { type: 'miss' }
  return nearest.kind === 'zombie' ? { type: 'zombie', meta: nearest.meta } : { type: 'blocked' }
}
