import type * as THREE from 'three'
import type { HitZone } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import type { RaycastHit } from './raycast_outcome.pure.lib.ts'

/**
 * How a scene object says what it is to a shot. A zombie's model meshes are
 * registered here with their carrier and a `zoneAt` that splits head from
 * body at the hit point (`tagZombieMesh`); an environment prop's invisible
 * collider carries `userData.raycastKind = 'environment'`; anything else
 * (decoration, the weapon, debug lines) never takes part.
 *
 * Zombie tags live in a WeakMap rather than `userData` so they stay typed
 * (three.js types `userData` as `any`) and drop with the mesh.
 */

export interface ZombieHitMeta {
  readonly carrierId: string
  readonly zone: HitZone
}

export interface ZombieTag {
  readonly carrierId: string
  readonly zoneAt: (point: THREE.Vector3) => HitZone
}

export type RaycastTag = ({ readonly raycastKind: 'zombie' } & ZombieTag) | { readonly raycastKind: 'environment' } | { readonly raycastKind: 'debug' }

const zombieTags = new WeakMap<THREE.Object3D, ZombieTag>()

/** Makes `mesh` a hit target for `tag`'s carrier, or (null) not a target at all, e.g. once defeated. */
export function tagZombieMesh(mesh: THREE.Object3D, tag: ZombieTag | null): void {
  if (tag === null) zombieTags.delete(mesh)
  else zombieTags.set(mesh, tag)
}

export const ENVIRONMENT_USER_DATA = { raycastKind: 'environment' } as const

export function readRaycastTag(object: THREE.Object3D): RaycastTag {
  const zombie = zombieTags.get(object)
  if (zombie !== undefined) return { raycastKind: 'zombie', ...zombie }
  const userData: unknown = object.userData
  if (typeof userData === 'object' && userData !== null && 'raycastKind' in userData && userData.raycastKind === 'environment') return { raycastKind: 'environment' }
  return { raycastKind: 'debug' }
}

/** Every intersection along a shot's ray, classified for `resolveRaycastOutcome`. */
export function classifyIntersections(intersections: readonly THREE.Intersection[]): readonly RaycastHit<ZombieHitMeta>[] {
  return intersections.map((intersection): RaycastHit<ZombieHitMeta> => {
    const tag = readRaycastTag(intersection.object)
    if (tag.raycastKind === 'zombie') return { kind: 'zombie', distance: intersection.distance, meta: { carrierId: tag.carrierId, zone: tag.zoneAt(intersection.point) } }
    return { kind: tag.raycastKind, distance: intersection.distance }
  })
}
