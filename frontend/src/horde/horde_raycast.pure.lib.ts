import type * as THREE from 'three'
import type { RaycastHit } from '@app/arena/raycast_outcome.pure.lib.ts'
import { readRaycastTag } from '@app/arena/raycast_tags.pure.lib.ts'
import type { ShotZone } from './horde_armory.pure.lib.ts'

/**
 * How a Zombie Horde zombie says what it is to a shot: its model meshes are
 * registered here with the zombie's id and a `zoneAt` that splits head, body,
 * and leg at the hit point. Cover colliders are the arena's environment tag
 * (`readRaycastTag`), so a shot blocked by cover resolves exactly as in
 * Equation Outbreak. Anything else (the floor, decoration) never takes part.
 *
 * A WeakMap rather than `userData`, so the tag stays typed and drops with the mesh.
 */

export interface HordeHitMeta {
  readonly zombieId: string
  readonly zone: ShotZone
}

export interface HordeZombieTag {
  readonly zombieId: string
  readonly zoneAt: (point: THREE.Vector3) => ShotZone
}

const hordeTags = new WeakMap<THREE.Object3D, HordeZombieTag>()

/** Makes `mesh` a hit target for `tag`'s zombie, or (null) not a target at all, e.g. once defeated. */
export function tagHordeMesh(mesh: THREE.Object3D, tag: HordeZombieTag | null): void {
  if (tag === null) hordeTags.delete(mesh)
  else hordeTags.set(mesh, tag)
}

/** Every intersection along a shot's ray, classified for `resolveRaycastOutcome`. */
export function classifyHordeIntersections(intersections: readonly THREE.Intersection[]): readonly RaycastHit<HordeHitMeta>[] {
  return intersections.map((intersection): RaycastHit<HordeHitMeta> => {
    const zombie = hordeTags.get(intersection.object)
    if (zombie !== undefined) return { kind: 'zombie', distance: intersection.distance, meta: { zombieId: zombie.zombieId, zone: zombie.zoneAt(intersection.point) } }
    const tag = readRaycastTag(intersection.object)
    return { kind: tag.raycastKind === 'environment' ? 'environment' : 'debug', distance: intersection.distance }
  })
}
