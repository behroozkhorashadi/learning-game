import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { unitSphereGeometry } from '../lib/sharedEnvironmentGeometry'

/**
 * The glowing purple-and-green archway the zombies visually emerge from.
 * Purely decorative — it has no gameplay authority over spawning (carriers
 * always start at `distance: 0`, i.e. each lane's own spawn point; see
 * `zombieWaveEngine.ts` and `laneNavigation.ts`) and, per
 * `EnvironmentCollider`'s docstring, its *collider* is a separate, plain
 * invisible box (see `environmentLayout.ts`'s `portal-frame` entry) — this
 * component only ever draws pixels, it never blocks or receives shots
 * itself (`raycast={() => null}` throughout, via `PrimShape` for the mist
 * motes and an explicit no-op on the ring/disc meshes below).
 *
 * Local space only: the parent `EnvironmentProp` positions this at the
 * portal's placement.
 */

const RING_COLOR = '#9D57FA'
const DISC_COLOR = '#3ADC6B'
const MIST_COUNT = 10

interface Props {
  reducedMotion: boolean
}

export function ExperimentPortal({ reducedMotion }: Props) {
  const ringGeometry = useMemo(() => new THREE.TorusGeometry(1.35, 0.16, 12, 32), [])
  const discGeometry = useMemo(() => new THREE.CircleGeometry(1.2, 32), [])
  const discRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  const mistSeeds = useMemo(
    () =>
      Array.from({ length: MIST_COUNT }, (_, i) => ({
        angle: (i / MIST_COUNT) * Math.PI * 2,
        radius: 0.5 + (i % 3) * 0.25,
        phase: i * 0.7,
      })),
    [],
  )
  const mistRefs = useRef<(THREE.Mesh | null)[]>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (discRef.current) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(t * 1.6) * 0.06
      discRef.current.scale.setScalar(pulse)
      const material = discRef.current.material as THREE.MeshBasicMaterial
      material.opacity = reducedMotion ? 0.75 : 0.65 + Math.sin(t * 1.6) * 0.1
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = reducedMotion ? 0 : t * 0.15
    }
    if (!reducedMotion) {
      mistSeeds.forEach((seed, i) => {
        const mote = mistRefs.current[i]
        if (!mote) return
        const bob = Math.sin(t * 0.8 + seed.phase) * 0.15
        mote.position.set(Math.cos(seed.angle) * seed.radius, -0.4 + bob + i * 0.02, Math.sin(seed.angle) * seed.radius * 0.4)
      })
    }
  })

  return (
    <group>
      <mesh ref={ringRef} geometry={ringGeometry} raycast={() => null} castShadow={false}>
        <meshStandardMaterial color={RING_COLOR} emissive={RING_COLOR} emissiveIntensity={0.9} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh ref={discRef} geometry={discGeometry} raycast={() => null}>
        <meshBasicMaterial color={DISC_COLOR} transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {!reducedMotion &&
        mistSeeds.map((seed, i) => (
          <mesh
            key={i}
            ref={(el) => {
              mistRefs.current[i] = el
            }}
            geometry={unitSphereGeometry}
            position={[Math.cos(seed.angle) * seed.radius, -0.4, Math.sin(seed.angle) * seed.radius * 0.4]}
            scale={0.08}
            raycast={() => null}
          >
            <meshBasicMaterial color={DISC_COLOR} transparent opacity={0.35} depthWrite={false} />
          </mesh>
        ))}
    </group>
  )
}
