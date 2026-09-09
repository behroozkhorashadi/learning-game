import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { WeaponDefinition } from '../lib/weaponDefinitions'

/**
 * Procedural first-person "math blaster" viewmodel — built from plain
 * Three.js primitives (no model exists yet; `weapon.rendererId` identifies
 * which renderer draws a given weapon, so a future GLB-based weapon can
 * replace this without the rest of the scene caring). Parented to the
 * camera so it stays fixed in the lower-right of the viewport regardless of
 * scene content, per "the camera does not move through the world."
 */

const RECOIL_KICK_RADIANS = 0.22
const IDLE_SWAY_AMPLITUDE = 0.015
const MAX_AIM_YAW = 0.12
const MAX_AIM_PITCH = 0.08

interface Props {
  weapon: WeaponDefinition
  /** Normalized device coordinates (-1..1) of the current aim point, or null
   * when there's no active pointer (e.g. touch, or keyboard-only input). */
  aimNdc: { x: number; y: number } | null
  /** Increment this every accepted shot to trigger a fresh recoil kick. */
  recoilSignal: number
  reducedMotion: boolean
}

export function MathBlaster3D({ weapon, aimNdc, recoilSignal, reducedMotion }: Props) {
  const { camera } = useThree()
  const pivot = useRef<THREE.Group>(null!)
  const muzzleFlash = useRef<THREE.Mesh>(null!)
  const recoilSignalRef = useRef(recoilSignal)
  const recoilStartRef = useRef<number | null>(null)

  if (recoilSignalRef.current !== recoilSignal) {
    recoilSignalRef.current = recoilSignal
    recoilStartRef.current = performance.now()
  }

  useFrame((state) => {
    if (!pivot.current) return

    const targetYaw = aimNdc ? THREE.MathUtils.clamp(-aimNdc.x, -1, 1) * MAX_AIM_YAW : 0
    const targetPitch = aimNdc ? THREE.MathUtils.clamp(aimNdc.y, -1, 1) * MAX_AIM_PITCH : 0
    pivot.current.rotation.y = THREE.MathUtils.lerp(pivot.current.rotation.y, targetYaw, 0.15)
    pivot.current.rotation.x = THREE.MathUtils.lerp(pivot.current.rotation.x, targetPitch, 0.15)

    const sway = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 1.4) * IDLE_SWAY_AMPLITUDE
    let recoil = 0
    if (recoilStartRef.current != null) {
      const elapsed = performance.now() - recoilStartRef.current
      const duration = weapon.recoilDurationMs
      if (elapsed < duration) {
        const t = elapsed / duration
        // Fast kick out, slower ease back — a small, child-friendly punch.
        recoil = (1 - t) * RECOIL_KICK_RADIANS * weapon.recoilStrength
      } else {
        recoilStartRef.current = null
      }
    }
    pivot.current.position.y = -0.32 + sway
    pivot.current.rotation.x += recoil

    if (muzzleFlash.current) {
      muzzleFlash.current.visible = recoil > RECOIL_KICK_RADIANS * weapon.recoilStrength * 0.35
    }
  })

  return (
    <group>
      {/* Parenting to the camera keeps the viewmodel screen-locked. */}
      <primitive object={camera}>
        <group ref={pivot} position={[0.42, -0.32, -0.75]} rotation={[0, 0, 0]}>
          {/* body */}
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.14, 0.14, 0.5]} />
            <meshStandardMaterial color="#5C85FF" roughness={0.35} metalness={0.1} />
          </mesh>
          {/* grip */}
          <mesh position={[0, -0.14, 0.12]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.09, 0.2, 0.09]} />
            <meshStandardMaterial color="#2A2E37" roughness={0.6} />
          </mesh>
          {/* barrel */}
          <mesh position={[0, 0.02, -0.32]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.22, 16]} />
            <meshStandardMaterial color="#F7B23B" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* fun accent fin */}
          <mesh position={[0, 0.09, -0.05]}>
            <boxGeometry args={[0.02, 0.08, 0.3]} />
            <meshStandardMaterial color="#5BCC2D" roughness={0.4} />
          </mesh>
          <mesh ref={muzzleFlash} position={[0, 0.02, -0.46]} visible={false}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial color="#FFF7D6" transparent opacity={0.9} />
          </mesh>
        </group>
      </primitive>
    </group>
  )
}
