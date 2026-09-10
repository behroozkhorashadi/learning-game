import type { Lane } from '../lib/laneNavigation'
import { unitPlaneGeometry } from '../lib/sharedEnvironmentGeometry'

/**
 * The visible floor strip for one approach lane — purely cosmetic
 * readability aid (makes the four lanes "visually distinct" per the brief)
 * with zero navigation authority: `laneNavigation.ts` already defines the
 * real corridor this decorates, and this component never invents its own
 * geometry for it — spawn Z, boundary Z, and width all come from `lane`.
 *
 * Deliberately subdued (low opacity, no motion) — the brief asks for the
 * *center* play area to stay calmer than the busier outer edges, and four
 * loud floor stripes running straight at the camera would fight the
 * zombies/answer labels for attention.
 */
interface Props {
  lane: Lane
  color: string
}

export function ApproachLane({ lane, color }: Props) {
  const [x] = lane.spawn
  const [, , z0] = lane.spawn
  const [, , z1] = lane.playerBoundary
  const length = Math.abs(z1 - z0)
  const centerZ = (z0 + z1) / 2

  return (
    <mesh position={[x, 0.01, centerZ]} rotation={[-Math.PI / 2, 0, 0]} scale={[lane.width * 0.82, length, 1]} geometry={unitPlaneGeometry} raycast={() => null} receiveShadow>
      <meshStandardMaterial color={color} transparent opacity={0.15} roughness={0.95} />
    </mesh>
  )
}
