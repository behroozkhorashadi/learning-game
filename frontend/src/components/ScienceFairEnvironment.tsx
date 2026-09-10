import type { Lane } from '../lib/laneNavigation'
import { PLAYER_BOUNDARY_Z, SPAWN_Z } from '../lib/laneNavigation'
import { PROP_PLACEMENTS, BACK_WALL_Z, type PropPlacement } from '../lib/environmentLayout'
import { ApproachLane } from './ApproachLane'
import { EnvironmentProp } from './EnvironmentProp'
import { ScienceFairBooth } from './ScienceFairBooth'
import { ExperimentPortal } from './ExperimentPortal'
import { PrimShape } from './PrimShape'
import { unitBoxGeometry, unitConeGeometry } from '../lib/sharedEnvironmentGeometry'

/**
 * "Outbreak at the Science Fair" — the full decorative set dressing behind
 * Equation Outbreak's shooting gallery: gym floor, four lane floor strips,
 * the glowing portal, science-fair booths and lockers along the side
 * aisles, banners and math-symbol accents on the walls, and the
 * warm-foreground/cool-background lighting rig.
 *
 * This component owns *only* rendering. Every prop's placement and
 * collision footprint comes from `environmentLayout.ts` /
 * `environmentColliders.ts`; every lane's geometry comes from
 * `laneNavigation.ts`. Nothing here computes a position that collision
 * validation doesn't already know about, and nothing here has any opinion
 * about wave/engine state — `EquationOutbreakScene` is the only caller, and
 * only for camera-relative composition and the zombies themselves.
 */

const LANE_COLORS = ['#9D57FA', '#144FFF', '#5BCC2D', '#F59E0B']
const PENNANT_COLORS = ['#F59E0B', '#5BCC2D', '#3D8BFF', '#D6336C', '#9D57FA']
const LOCKER_COLORS = ['#F59E0B', '#3D8BFF', '#5BCC2D', '#D6336C']

function LockerRow() {
  const doorWidth = 0.6
  const doors = LOCKER_COLORS
  const totalWidth = doorWidth * doors.length
  return (
    <group>
      {doors.map((color, i) => (
        <PrimShape
          key={i}
          geometry={unitBoxGeometry}
          color={color}
          position={[-totalWidth / 2 + doorWidth * (i + 0.5), 0, 0]}
          scale={[doorWidth * 0.9, 1.1, 0.5]}
          castShadow
        />
      ))}
    </group>
  )
}

function PlainWall({ halfExtents }: { halfExtents: readonly [number, number, number] }) {
  return <PrimShape geometry={unitBoxGeometry} color="#7C6BAE" scale={[halfExtents[0] * 2, halfExtents[1] * 2, halfExtents[2] * 2]} receiveShadow />
}

/** A row of small hanging pennants, purely decorative — high enough (y≈3.1)
 * to sit well above zombie head height and out of the central sightline,
 * per the brief's "keep the central play area less visually busy." */
function BannerString({ x, zStart, zEnd, count }: { x: number; zStart: number; zEnd: number; count: number }) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const z = zStart + ((zEnd - zStart) * i) / Math.max(1, count - 1)
        return <PrimShape key={i} geometry={unitConeGeometry} color={PENNANT_COLORS[i % PENNANT_COLORS.length]} position={[x, 3.1, z]} rotation={[Math.PI, 0, 0]} scale={[0.22, 0.3, 0.05]} />
      })}
    </group>
  )
}

function PlusSymbol({ position, color }: { position: readonly [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <PrimShape geometry={unitBoxGeometry} color={color} scale={[0.42, 0.08, 0.06]} />
      <PrimShape geometry={unitBoxGeometry} color={color} scale={[0.08, 0.42, 0.06]} />
    </group>
  )
}

function EqualsSymbol({ position, color }: { position: readonly [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <PrimShape geometry={unitBoxGeometry} color={color} position={[0, 0.13, 0]} scale={[0.42, 0.08, 0.06]} />
      <PrimShape geometry={unitBoxGeometry} color={color} position={[0, -0.13, 0]} scale={[0.42, 0.08, 0.06]} />
    </group>
  )
}

function propContent(placement: PropPlacement, reducedMotion: boolean) {
  switch (placement.kind) {
    case 'booth':
      return placement.subject ? <ScienceFairBooth subject={placement.subject} /> : null
    case 'portalFrame':
      return <ExperimentPortal reducedMotion={reducedMotion} />
    case 'locker':
      return <LockerRow />
    case 'wall':
      return <PlainWall halfExtents={placement.halfExtents} />
    default:
      return null
  }
}

interface Props {
  lanes: Lane[]
  reducedMotion: boolean
  onBlockedShot: (point: readonly [number, number, number]) => void
}

export function ScienceFairEnvironment({ lanes, reducedMotion, onBlockedShot }: Props) {
  return (
    <group>
      {/* warm foreground light, near the player */}
      <pointLight position={[0, 2.2, 2.4]} color="#FFD9A0" intensity={0.85} distance={9} decay={2} />
      {/* cool purple/blue background wash */}
      <hemisphereLight args={['#CBB8F2', '#3B2F5C', 0.5]} />
      <directionalLight position={[3, 6, 2]} intensity={1.1} color="#EFE6FF" castShadow={!reducedMotion} shadow-mapSize={[1024, 1024]} />
      <ambientLight intensity={0.55} />

      <fog attach="fog" args={['#A98FE0', 8, 22]} />

      {/* gym floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -6]} receiveShadow raycast={() => null}>
        <planeGeometry args={[16, 24]} />
        <meshStandardMaterial color="#8B7BC9" roughness={0.92} />
      </mesh>

      {lanes.map((lane, i) => (
        <ApproachLane key={lane.id} lane={lane} color={LANE_COLORS[i % LANE_COLORS.length]} />
      ))}

      {/* player boundary marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, PLAYER_BOUNDARY_Z]} raycast={() => null}>
        <planeGeometry args={[8, 0.08]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.6} />
      </mesh>

      {/* soft atmospheric backdrop behind the portal */}
      <mesh position={[0, 4, SPAWN_Z - 4]} raycast={() => null}>
        <planeGeometry args={[30, 14]} />
        <meshBasicMaterial color="#A98FE0" />
      </mesh>

      {PROP_PLACEMENTS.map((placement) => (
        <EnvironmentProp key={placement.id} placement={placement} onBlockedShot={onBlockedShot}>
          {propContent(placement, reducedMotion)}
        </EnvironmentProp>
      ))}

      {/* banners — cloth, not solid: decorative only, no collider */}
      <BannerString x={-5.8} zStart={SPAWN_Z + 1} zEnd={-2} count={5} />
      <BannerString x={5.8} zStart={SPAWN_Z + 1} zEnd={-2} count={5} />

      {/* sparse math-symbol accents on the back wall, well clear of the
       * equation HUD and answer labels which live in front of the camera */}
      <PlusSymbol position={[-2.2, 3.4, BACK_WALL_Z + 0.25]} color="#FFFFFF" />
      <EqualsSymbol position={[2.2, 3.4, BACK_WALL_Z + 0.25]} color="#FFFFFF" />
    </group>
  )
}

