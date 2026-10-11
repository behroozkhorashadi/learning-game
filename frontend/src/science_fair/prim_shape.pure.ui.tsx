import type { ReactElement } from 'react'
import type * as THREE from 'three'

/**
 * One decorative mesh over a shared unit geometry: every Science Fair prop is
 * built from a handful of these instead of one-off geometries. Decoration is
 * never a hit target, so raycasting is off: only the colliders and the zombies
 * take part in shots, and the raycaster skips dozens of decorative triangles.
 *
 * The defaults are three.js's own.
 */
export interface PrimShapeProps {
  readonly geometry: THREE.BufferGeometry
  readonly color: string
  readonly position?: readonly [number, number, number]
  readonly rotation?: readonly [number, number, number]
  readonly scale?: readonly [number, number, number] | number
  readonly emissive?: string
  readonly emissiveIntensity?: number
  readonly roughness?: number
  readonly metalness?: number
  readonly transparent?: boolean
  readonly opacity?: number
  readonly castShadow?: boolean
  readonly receiveShadow?: boolean
}

export function PrimShape({
  geometry,
  color,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  emissive = '#000000',
  emissiveIntensity = 1,
  roughness = 0.6,
  metalness = 0.1,
  transparent = false,
  opacity = 1,
  castShadow = false,
  receiveShadow = false,
}: PrimShapeProps): ReactElement {
  return (
    <mesh position={position} rotation={rotation} scale={scale} castShadow={castShadow} receiveShadow={receiveShadow} raycast={() => null}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={roughness} metalness={metalness} transparent={transparent} opacity={opacity} />
    </mesh>
  )
}
