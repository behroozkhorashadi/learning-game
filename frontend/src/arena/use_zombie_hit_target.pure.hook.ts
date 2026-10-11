import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, type RefObject } from 'react'
import * as THREE from 'three'
import type { HitZone } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import { writePositionAlongLane, type Lane } from './lane_navigation.pure.lib.ts'
import { tagZombieMesh } from './raycast_tags.pure.lib.ts'

/**
 * The skinned mesh's bounding sphere is computed once, from whatever pose it's
 * in, and reused as the raycast early-out; padding it keeps a later pose (an
 * arm swung forward mid-stride) from being culled.
 */
const BOUNDING_SPHERE_PADDING = 1.5

/**
 * Places a zombie on its lane and makes its model the carrier's hit target.
 *
 * Position: the outer group is the only source of where a zombie sits,
 * `carrier.distance` (the wave engine's) mapped onto its lane path. Set
 * imperatively every frame, allocation-free, not as a `position` prop.
 *
 * Hit target: while the carrier is hittable, every mesh in the model is
 * tagged with it, and head vs. body is decided per shot by whether the hit is
 * above the head bone. The real skinned mesh in its current pose is tested
 * (three.js applies bones when raycasting), so hair, hats, hands, and feet
 * all count: what you see is what you can hit.
 */
export function useZombieHitTarget(
  groupRef: RefObject<THREE.Group | null>,
  modelRef: RefObject<THREE.Group | null>,
  {
    lane,
    distance,
    carrierId,
    canBeHit,
    headBone,
    rigVersion,
  }: {
    readonly lane: Lane
    readonly distance: number
    readonly carrierId: string
    readonly canBeHit: boolean
    readonly headBone: THREE.Object3D | null
    /** Bumped each time the model mounts a fresh clone, so its new meshes get tagged too. */
    readonly rigVersion: number
  },
): void {
  useLayoutEffect(() => {
    if (groupRef.current) writePositionAlongLane(lane, distance, groupRef.current.position)
  })

  useFrame(() => {
    if (groupRef.current) writePositionAlongLane(lane, distance, groupRef.current.position)
  })

  useLayoutEffect(() => {
    const model = modelRef.current
    if (model === null) return
    const headWorld = new THREE.Vector3()
    const zoneAt = (point: THREE.Vector3): HitZone => {
      if (headBone === null) return 'body'
      headBone.getWorldPosition(headWorld)
      return point.y >= headWorld.y ? 'head' : 'body'
    }
    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      tagZombieMesh(obj, canBeHit ? { carrierId, zoneAt } : null)
      if (canBeHit && obj instanceof THREE.SkinnedMesh) {
        obj.computeBoundingSphere()
        obj.boundingSphere.radius *= BOUNDING_SPHERE_PADDING
      }
    })
  }, [modelRef, canBeHit, carrierId, headBone, rigVersion])
}
