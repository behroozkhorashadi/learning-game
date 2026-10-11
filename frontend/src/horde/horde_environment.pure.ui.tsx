import type { ReactElement } from 'react'
import { ENVIRONMENT_USER_DATA } from '@app/arena/raycast_tags.pure.lib.ts'
import { PrimShape } from '@app/science_fair/prim_shape.pure.ui.tsx'
import { unitBoxGeometry, unitCylinderGeometry } from '@app/science_fair/shared_geometry.pure.lib.ts'
import { CONTACT_DEPTH, SPAWN_DEPTH, maxAbsX, worldPosition, type Cover } from './horde_field.pure.lib.ts'

/**
 * Zombie Horde's set: a long gym floor that widens toward the back, the
 * player's line, lighting, and the cover pieces. Every cover piece has an
 * invisible collider exactly its size, tagged as environment, so a shot that
 * hits it is blocked (the scene's single click handler resolves it). The
 * floor is raycastable but untagged: grenades aim at it, shots ignore it.
 */

const FLOOR_LENGTH = SPAWN_DEPTH + 6
/** Wide enough to reach past the edges of the view on any screen. */
const FLOOR_WIDTH = 80

function Crates({ cover }: { readonly cover: Cover }): ReactElement {
  const w = cover.halfWidth * 2
  const d = cover.halfDepth * 2
  const h = cover.height
  return (
    <group>
      <PrimShape geometry={unitBoxGeometry} color="#B07A3F" position={[-w * 0.24, h * 0.3, 0]} scale={[w * 0.5, h * 0.6, d]} castShadow receiveShadow />
      <PrimShape geometry={unitBoxGeometry} color="#C48A4A" position={[w * 0.24, h * 0.3, 0]} scale={[w * 0.5, h * 0.6, d * 0.95]} castShadow receiveShadow />
      <PrimShape geometry={unitBoxGeometry} color="#A36E36" position={[0, h * 0.8, 0]} scale={[w * 0.55, h * 0.4, d * 0.85]} castShadow receiveShadow />
    </group>
  )
}

function Lockers({ cover }: { readonly cover: Cover }): ReactElement {
  const doors = 3
  const w = (cover.halfWidth * 2) / doors
  return (
    <group>
      {Array.from({ length: doors }, (_, i) => (
        <PrimShape key={i} geometry={unitBoxGeometry} color={['#3D8BFF', '#F59E0B', '#5BCC2D'][i % 3] ?? '#3D8BFF'} position={[-cover.halfWidth + w * (i + 0.5), cover.height / 2, 0]} scale={[w * 0.94, cover.height, cover.halfDepth * 2]} castShadow receiveShadow />
      ))}
    </group>
  )
}

function Table({ cover }: { readonly cover: Cover }): ReactElement {
  const w = cover.halfWidth * 2
  const d = cover.halfDepth * 2
  return (
    <group>
      {/* tipped on its side as a barricade: the top faces the player */}
      <PrimShape geometry={unitBoxGeometry} color="#E8E1D0" position={[0, cover.height / 2, cover.halfDepth - 0.06]} scale={[w, cover.height, 0.12]} castShadow receiveShadow />
      {[-1, 1].map((side) => (
        <PrimShape key={side} geometry={unitCylinderGeometry} color="#6B7280" position={[side * (w / 2 - 0.15), cover.height * 0.3, -d * 0.1]} rotation={[Math.PI / 2, 0, 0]} scale={[0.08, d * 0.8, 0.08]} />
      ))}
    </group>
  )
}

function Barrier({ cover }: { readonly cover: Cover }): ReactElement {
  const w = cover.halfWidth * 2
  const stripes = 5
  return (
    <group>
      {Array.from({ length: stripes }, (_, i) => (
        <PrimShape key={i} geometry={unitBoxGeometry} color={i % 2 === 0 ? '#F2C94C' : '#2A2E37'} position={[-w / 2 + (w / stripes) * (i + 0.5), cover.height / 2, 0]} scale={[w / stripes, cover.height, cover.halfDepth * 2]} castShadow receiveShadow />
      ))}
    </group>
  )
}

function CoverPiece({ cover }: { readonly cover: Cover }): ReactElement {
  const [x, , z] = worldPosition(cover.x, cover.depth)
  return (
    <group position={[x, 0, z]}>
      {cover.kind === 'crates' && <Crates cover={cover} />}
      {cover.kind === 'lockers' && <Lockers cover={cover} />}
      {cover.kind === 'table' && <Table cover={cover} />}
      {cover.kind === 'barrier' && <Barrier cover={cover} />}
      {/* the hit volume: invisible by a transparent material (an invisible mesh isn't raycast) */}
      <mesh name={`collider-${cover.id}`} position={[0, cover.height / 2, 0]} userData={ENVIRONMENT_USER_DATA}>
        <boxGeometry args={[cover.halfWidth * 2, cover.height, cover.halfDepth * 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

export interface HordeEnvironmentProps {
  readonly cover: readonly Cover[]
  readonly shadows: boolean
}

export function HordeEnvironment({ cover, shadows }: HordeEnvironmentProps): ReactElement {
  return (
    <group>
      <hemisphereLight args={['#CBB8F2', '#3B2F5C', 0.6]} />
      <directionalLight position={[4, 9, 3]} intensity={1.2} color="#EFE6FF" castShadow={shadows} shadow-mapSize={[1024, 1024]} />
      <ambientLight intensity={0.5} />
      <fog attach="fog" args={['#A98FE0', 14, 34]} />

      {/* the floor: raycastable (grenades land on it), untagged (shots ignore it) */}
      <mesh name="floor" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -FLOOR_LENGTH / 2 + 2]} receiveShadow>
        <planeGeometry args={[FLOOR_WIDTH, FLOOR_LENGTH]} />
        <meshStandardMaterial color="#8B7BC9" roughness={0.92} />
      </mesh>

      {/* the player's line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -CONTACT_DEPTH]} raycast={() => null}>
        <planeGeometry args={[maxAbsX(CONTACT_DEPTH) * 2, 0.08]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.7} />
      </mesh>

      {/* backdrop */}
      <mesh position={[0, 5, -SPAWN_DEPTH - 5]} raycast={() => null}>
        <planeGeometry args={[FLOOR_WIDTH + 20, 16]} />
        <meshBasicMaterial color="#A98FE0" />
      </mesh>

      {cover.map((piece) => (
        <CoverPiece key={piece.id} cover={piece} />
      ))}
    </group>
  )
}
