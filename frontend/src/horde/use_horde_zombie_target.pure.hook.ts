import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { ShotZone } from './horde_armory.pure.lib.ts'
import { worldPosition } from './horde_field.pure.lib.ts'
import { tagHordeMesh } from './horde_raycast.pure.lib.ts'
import { zoneAlongBody } from './horde_scene_rules.pure.lib.ts'

/** Padding on the skinned mesh's cached bounding sphere, so a later pose (an arm thrown out, lying flat) isn't culled from raycasts. */
const BOUNDING_SPHERE_PADDING = 1.8
/** How quickly the drawn zombie catches up with the engine's position and facing (per second). */
const FOLLOW_RATE = 14
const TURN_RATE = 8

export interface HordeZombieTargetOptions {
  readonly zombieId: string
  readonly x: number
  readonly depth: number
  readonly heading: number
  readonly canBeHit: boolean
  readonly headBone: THREE.Object3D | null
  readonly hipsBone: THREE.Object3D | null
  /** Bumped each time the model mounts a fresh clone, so its new meshes get tagged too. */
  readonly rigVersion: number
}

/**
 * Places a roaming zombie on the field and makes its model the zombie's hit target.
 *
 * Position and facing: the outer group follows the engine's `x`/`depth` and
 * `heading`, eased a little each frame so a 60fps engine step never reads as
 * jitter. Set imperatively in `useFrame`, allocation-free.
 *
 * Hit target: while it can be hit, every mesh in the model is tagged, and
 * head/body/leg is decided per shot along the line from the head bone to the
 * hips bone (`zoneAlongBody`), so it works standing or lying down.
 */
export function useHordeZombieTarget(groupRef: RefObject<THREE.Group | null>, modelRef: RefObject<THREE.Group | null>, options: HordeZombieTargetOptions): void {
  const { zombieId, canBeHit, headBone, hipsBone, rigVersion } = options
  const latest = useRef(options)
  const placed = useRef(false)
  useLayoutEffect(() => {
    latest.current = options
    const group = groupRef.current
    if (group !== null && !placed.current) {
      const [x, y, z] = worldPosition(options.x, options.depth)
      group.position.set(x, y, z)
      group.rotation.y = options.heading
      placed.current = true
    }
  })

  useFrame((_, delta) => {
    const group = groupRef.current
    if (group === null) return
    const { x, depth, heading } = latest.current
    const [wx, , wz] = worldPosition(x, depth)
    const follow = Math.min(1, delta * FOLLOW_RATE)
    group.position.x += (wx - group.position.x) * follow
    group.position.z += (wz - group.position.z) * follow
    let turn = heading - group.rotation.y
    if (turn > Math.PI) turn -= Math.PI * 2
    else if (turn < -Math.PI) turn += Math.PI * 2
    group.rotation.y += turn * Math.min(1, delta * TURN_RATE)
  })

  useLayoutEffect(() => {
    const model = modelRef.current
    if (model === null) return
    const head = new THREE.Vector3()
    const hips = new THREE.Vector3()
    const zoneAt = (point: THREE.Vector3): ShotZone => {
      if (headBone === null || hipsBone === null) return 'body'
      headBone.getWorldPosition(head)
      hipsBone.getWorldPosition(hips)
      return zoneAlongBody([point.x, point.y, point.z], [head.x, head.y, head.z], [hips.x, hips.y, hips.z])
    }
    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      tagHordeMesh(obj, canBeHit ? { zombieId, zoneAt } : null)
      if (canBeHit && obj instanceof THREE.SkinnedMesh) {
        obj.computeBoundingSphere()
        obj.boundingSphere.radius *= BOUNDING_SPHERE_PADDING
      }
    })
  }, [modelRef, canBeHit, zombieId, headBone, hipsBone, rigVersion])
}
