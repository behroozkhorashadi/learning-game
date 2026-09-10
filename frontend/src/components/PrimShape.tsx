import type * as THREE from 'three'

/**
 * A single reusable-geometry decorative mesh — every Science Fair prop is
 * built from a handful of these rather than one-off geometries per shape.
 * Purely decorative meshes never need to be clickable, so `raycast`
 * defaults to a no-op: nothing here can ever intercept a shot, block a
 * shot, or otherwise participate in gameplay raycasting (only
 * `EnvironmentCollider`'s invisible boxes and the zombies' hitboxes do —
 * see that component's docstring). This also saves the raycaster from
 * bothering with dozens of decorative triangles on every click.
 */
interface Props {
  geometry: THREE.BufferGeometry
  color: string
  position?: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  scale?: readonly [number, number, number] | number
  emissive?: string
  emissiveIntensity?: number
  roughness?: number
  metalness?: number
  transparent?: boolean
  opacity?: number
  castShadow?: boolean
  receiveShadow?: boolean
}

export function PrimShape({
  geometry,
  color,
  position,
  rotation,
  scale,
  emissive,
  emissiveIntensity,
  roughness = 0.6,
  metalness = 0.1,
  transparent,
  opacity,
  castShadow,
  receiveShadow,
}: Props) {
  return (
    <mesh position={position} rotation={rotation} scale={scale} castShadow={castShadow} receiveShadow={receiveShadow} raycast={() => null}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={roughness}
        metalness={metalness}
        transparent={transparent}
        opacity={opacity}
      />
    </mesh>
  )
}
