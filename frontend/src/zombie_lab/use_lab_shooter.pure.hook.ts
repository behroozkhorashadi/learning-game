import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { resolveRaycastOutcome } from '@app/arena/raycast_outcome.pure.lib.ts'
import { classifyIntersections, readRaycastTag } from '@app/arena/raycast_tags.pure.lib.ts'
import type { Outcome } from './hit_lab_state.pure.lib.ts'

/** How many consecutive frames the zombie must be a hit target before a setup counts as settled (posed and tagged). */
export const SETTLED_FRAMES = 8

/** Whether anything under `root` is currently a zombie hit target. */
function hasZombieTarget(root: THREE.Object3D): boolean {
  const pending: THREE.Object3D[] = [root]
  for (let obj = pending.pop(); obj !== undefined; obj = pending.pop()) {
    if (readRaycastTag(obj).raycastKind === 'zombie') return true
    pending.push(...obj.children)
  }
  return false
}

export interface LabShooter {
  /** Casts the camera ray through `ndc` and classifies it exactly as the game's pointer handlers do. */
  readonly shoot: (ndc: { readonly x: number; readonly y: number }) => Outcome
  /** Whether the scene currently has a hittable zombie. */
  readonly hasZombie: () => boolean
}

/**
 * Runs inside the hit lab's <Canvas>. Hands the lab a shooter that mirrors the
 * game's pointer path without R3F's event dispatch (the camera ray, then the
 * same `classifyIntersections` + `resolveRaycastOutcome`), and tells it once
 * per `setupKey` when the zombie has been a hit target for SETTLED_FRAMES
 * frames in a row: the page's "ready to shoot" signal.
 */
export function useLabShooter(setupKey: string, onShooter: (shooter: LabShooter | null) => void, onSettled: (setupKey: string) => void): void {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const [raycaster] = useState(() => new THREE.Raycaster())
  const [pointer] = useState(() => new THREE.Vector2())
  const latest = useRef({ onShooter, onSettled })
  useLayoutEffect(() => {
    latest.current = { onShooter, onSettled }
  })
  const steadyFramesRef = useRef(0)
  const settledKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const hasZombie = (): boolean => hasZombieTarget(scene)
    latest.current.onShooter({
      shoot: (ndc) => {
        raycaster.setFromCamera(pointer.set(ndc.x, ndc.y), camera)
        const outcome = resolveRaycastOutcome(classifyIntersections(raycaster.intersectObjects(scene.children, true)))
        return outcome.type === 'zombie' ? outcome.meta.zone : 'miss'
      },
      hasZombie,
    })
    return () => {
      latest.current.onShooter(null)
    }
  }, [camera, scene, raycaster, pointer])

  useFrame(() => {
    if (settledKeyRef.current === setupKey) return
    steadyFramesRef.current = hasZombieTarget(scene) ? steadyFramesRef.current + 1 : 0
    if (steadyFramesRef.current >= SETTLED_FRAMES) {
      settledKeyRef.current = setupKey
      steadyFramesRef.current = 0
      latest.current.onSettled(setupKey)
    }
  })
}
