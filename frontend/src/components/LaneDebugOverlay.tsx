import { Line } from '@react-three/drei'
import type { Lane, Vec3 } from '../lib/laneNavigation'
import { laneCorridor } from '../lib/laneNavigation'
import { ENVIRONMENT_COLLIDERS, colliderBox } from '../lib/environmentColliders'

/**
 * Development-only visualization of the navigation/collision data every
 * lane and prop is actually built from — lane centerlines, corridor
 * boundaries, spawn points, the player boundary, environment collider
 * boxes, and the current position of any active carrier. Every line here
 * uses `raycast={() => null}` (and `Line`/`<points>` primitives aren't
 * raycast targets to begin with) so it can never intercept or block a real
 * shot, satisfying the "debug helpers must be disabled in normal gameplay,
 * and never interfere when enabled" requirement from both directions.
 *
 * Toggled via `?debugLanes=1` (see `useDebugLanesEnabled` in
 * `ZombieMathBlaster.tsx`), gated to `import.meta.env.DEV` — never rendered
 * in a production build.
 */

const CENTERLINE_COLOR = '#FFFFFF'
const CORRIDOR_COLOR = '#00E5FF'
const COLLIDER_COLOR = '#FF3B57'
const CARRIER_COLOR = '#FFD23B'

function corridorOutline(lane: Lane): Vec3[] {
  const corridor = laneCorridor(lane)
  const y = 0.02
  return [
    [corridor.minX, y, corridor.minZ],
    [corridor.maxX, y, corridor.minZ],
    [corridor.maxX, y, corridor.maxZ],
    [corridor.minX, y, corridor.maxZ],
    [corridor.minX, y, corridor.minZ],
  ]
}

function boxOutline(center: Vec3, halfExtents: Vec3): Vec3[][] {
  const box = colliderBox({ id: 'debug', center, halfExtents })
  const corners = (y: number): Vec3[] => [
    [box.minX, y, box.minZ],
    [box.maxX, y, box.minZ],
    [box.maxX, y, box.maxZ],
    [box.minX, y, box.maxZ],
    [box.minX, y, box.minZ],
  ]
  const verticalEdges: Vec3[][] = [
    [
      [box.minX, box.minY, box.minZ],
      [box.minX, box.maxY, box.minZ],
    ],
    [
      [box.maxX, box.minY, box.minZ],
      [box.maxX, box.maxY, box.minZ],
    ],
    [
      [box.maxX, box.minY, box.maxZ],
      [box.maxX, box.maxY, box.maxZ],
    ],
    [
      [box.minX, box.minY, box.maxZ],
      [box.minX, box.maxY, box.maxZ],
    ],
  ]
  return [corners(box.minY), corners(box.maxY), ...verticalEdges]
}

interface Props {
  lanes: Lane[]
  activeCarrierPositions: { lane: number; position: Vec3 }[]
}

export function LaneDebugOverlay({ lanes, activeCarrierPositions }: Props) {
  return (
    <group>
      {lanes.map((lane) => (
        <group key={lane.id}>
          <Line points={lane.waypoints as unknown as [number, number, number][]} color={CENTERLINE_COLOR} lineWidth={1.5} raycast={() => null} />
          <Line points={corridorOutline(lane) as [number, number, number][]} color={CORRIDOR_COLOR} lineWidth={1} raycast={() => null} />
          <mesh position={[lane.spawn[0], 0.05, lane.spawn[2]]} raycast={() => null}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color={CENTERLINE_COLOR} />
          </mesh>
          <mesh position={[lane.playerBoundary[0], 0.05, lane.playerBoundary[2]]} raycast={() => null}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color={CORRIDOR_COLOR} />
          </mesh>
        </group>
      ))}

      {ENVIRONMENT_COLLIDERS.map((collider) => (
        <group key={collider.id}>
          {boxOutline(collider.center, collider.halfExtents).map((points, i) => (
            <Line key={i} points={points as [number, number, number][]} color={COLLIDER_COLOR} lineWidth={1} raycast={() => null} />
          ))}
        </group>
      ))}

      {activeCarrierPositions.map(({ lane, position }) => (
        <mesh key={lane} position={position as unknown as [number, number, number]} raycast={() => null}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color={CARRIER_COLOR} wireframe />
        </mesh>
      ))}
    </group>
  )
}
