/**
 * Pure classification of "what did this shot actually hit" — factored out
 * of `EquationOutbreakScene` so the nearest-hit-wins / environment-blocks /
 * debug-is-invisible rules can be unit tested directly, without a WebGL
 * context. The renderer feeds this the raw, unsorted list of everything a
 * raycast intersected (each tagged with a `kind` via `userData` — see
 * `EnvironmentCollider.tsx` and the zombie hitboxes in
 * `EquationOutbreakScene.tsx`) and acts on whatever comes back.
 *
 * Three.js/R3F's own nearest-object-first event dispatch already makes an
 * environment collider block a farther zombie hitbox in practice (each
 * tagged mesh's handler calls `stopPropagation`, so only the nearest one
 * ever runs) — this function is the second, independently-testable source
 * of truth for that same rule, and is what the real handler actually calls
 * rather than trusting dispatch order alone.
 */

export type RaycastHitKind = 'zombie' | 'environment' | 'debug'

export interface RaycastHit<Meta = unknown> {
  kind: RaycastHitKind
  distance: number
  meta?: Meta
}

export type RaycastOutcome<Meta = unknown> = { type: 'miss' } | { type: 'blocked' } | { type: 'zombie'; meta: Meta }

/** `hits` need not be pre-sorted or pre-filtered — debug-tagged hits (and
 * anything untagged/unknown) are ignored entirely, regardless of how close
 * they are; among what's left, the nearest wins. */
export function resolveRaycastOutcome<Meta>(hits: RaycastHit<Meta>[]): RaycastOutcome<Meta> {
  const relevant = hits.filter((hit) => hit.kind === 'zombie' || hit.kind === 'environment')
  if (relevant.length === 0) return { type: 'miss' }

  const nearest = relevant.reduce((closest, hit) => (hit.distance < closest.distance ? hit : closest))
  if (nearest.kind === 'environment') return { type: 'blocked' }
  return { type: 'zombie', meta: nearest.meta as Meta }
}
