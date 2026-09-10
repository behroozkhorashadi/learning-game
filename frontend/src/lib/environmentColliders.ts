import { buildLanes, computeLaneLayout, laneCorridor, WIDEST_LAYOUT, type CorridorBox, type Lane, type Vec3 } from './laneNavigation'
import { PROP_PLACEMENTS, type PropPlacement } from './environmentLayout'

/**
 * Collision math for the Science Fair environment — pure, Three.js-free, so
 * "does this corridor actually stay clear" and "does this shot actually
 * stop here" can both be asserted in a plain unit test rather than trusted
 * by eye in a WebGL scene. Rendering (`EnvironmentCollider.tsx`) and
 * placement (`environmentLayout.ts`) are deliberately separate files — this
 * one only ever does box-vs-box and box-vs-corridor arithmetic.
 */

export interface EnvironmentCollider {
  id: string
  center: Vec3
  halfExtents: Vec3
}

export interface Box3 {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

export function colliderBox(collider: EnvironmentCollider): Box3 {
  const [cx, cy, cz] = collider.center
  const [hx, hy, hz] = collider.halfExtents
  return { minX: cx - hx, maxX: cx + hx, minY: cy - hy, maxY: cy + hy, minZ: cz - hz, maxZ: cz + hz }
}

export function boxIntersectsCorridor(box: Box3, corridor: CorridorBox): boolean {
  return (
    box.maxX >= corridor.minX &&
    box.minX <= corridor.maxX &&
    box.maxY >= corridor.minY &&
    box.minY <= corridor.maxY &&
    box.maxZ >= corridor.minZ &&
    box.minZ <= corridor.maxZ
  )
}

function toCollider(placement: PropPlacement): EnvironmentCollider {
  return { id: placement.id, center: placement.position, halfExtents: placement.halfExtents }
}

/** Every solid object in the Science Fair set, derived from the single
 * placement list in `environmentLayout.ts` — the same numbers that drive
 * rendering, so a collider can never silently disagree with what's drawn. */
export const ENVIRONMENT_COLLIDERS: EnvironmentCollider[] = PROP_PLACEMENTS.map(toCollider)

/** True only if no collider overlaps the lane's corridor — the invariant
 * every lane must satisfy for a carrier to be guaranteed a clear path. */
export function isCorridorClearOfColliders(lane: Lane, colliders: EnvironmentCollider[] = ENVIRONMENT_COLLIDERS): boolean {
  const corridor = laneCorridor(lane)
  return colliders.every((collider) => !boxIntersectsCorridor(colliderBox(collider), corridor))
}

/** The outer edge (in X) of the widest a lane corridor can ever get across
 * the whole responsive range, plus a small margin — decorative props
 * anchored at or beyond this X stay clear of every lane at every viewport
 * size without needing to move on resize. */
export function safePropStartX(marginX = 0.5): number {
  const lanes = buildLanes(WIDEST_LAYOUT)
  const outer = lanes[lanes.length - 1]
  return outer.spawn[0] + outer.width / 2 + marginX
}

/** Samples lane layouts across the supported aspect-ratio range and checks
 * every lane stays clear of every collider at each sample — used by tests
 * to prove the "responsive configuration still produces valid lanes"
 * requirement for the actual environment, not just the default layout. */
export function isEnvironmentClearAcrossResponsiveRange(
  aspectRatios: number[],
  colliders: EnvironmentCollider[] = ENVIRONMENT_COLLIDERS,
): boolean {
  return aspectRatios.every((aspectRatio) => {
    const lanes = buildLanes(computeLaneLayout(aspectRatio))
    return lanes.every((lane) => isCorridorClearOfColliders(lane, colliders))
  })
}
