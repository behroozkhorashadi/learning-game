import type { ThreeEvent } from '@react-three/fiber'
import type { EnvironmentCollider as ColliderData } from '../lib/environmentColliders'
import { resolveRaycastOutcome, type RaycastHit } from '../lib/raycastOutcome'
import type { HitZone } from '../lib/zombieWaveEngine'

/**
 * The real, invisible hit-volume for a solid environment object — matches
 * `environmentColliders.ts`'s collision math exactly (same `collider`
 * object), not the decorative mesh a `ScienceFairBooth`/`ExperimentPortal`
 * draws next to it. Invisible via a fully transparent material rather than
 * `visible={false}`, mirroring the existing zombie-hitbox pattern in
 * `EquationOutbreakScene.tsx` — an invisible-but-`visible`-true mesh stays
 * raycastable; toggling `visible` off would not.
 *
 * Blocking works the same way head/body hitbox priority already does on a
 * single zombie: `stopPropagation` plus Three.js/R3F's nearest-object-first
 * pointer dispatch means whichever tagged mesh (this, or a zombie hitbox)
 * is geometrically nearest along the ray fires first. That handler then
 * re-derives the *true* nearest relevant hit via `resolveRaycastOutcome`
 * from `event.intersections` — the full sorted hit list R3F attaches to
 * every pointer event — rather than assuming "I fired, so I must be
 * nearest," so the same tested rule governs both the live scene and
 * `raycastOutcome.test.ts`.
 */

interface ZombieHitMeta {
  carrierId: string
  zone: HitZone
}

export function collectRaycastHits(event: ThreeEvent<PointerEvent>): RaycastHit<ZombieHitMeta>[] {
  return event.intersections.map((intersection) => {
    const data = intersection.object.userData as { raycastKind?: 'zombie' | 'environment' | 'debug'; carrierId?: string; zone?: HitZone }
    const meta = data.carrierId && data.zone ? { carrierId: data.carrierId, zone: data.zone } : undefined
    return { kind: data.raycastKind ?? 'debug', distance: intersection.distance, meta }
  })
}

interface Props {
  collider: ColliderData
  onBlockedShot: (point: readonly [number, number, number]) => void
}

export function EnvironmentCollider({ collider, onBlockedShot }: Props) {
  const [cx, cy, cz] = collider.center
  const [hx, hy, hz] = collider.halfExtents

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation()
    const outcome = resolveRaycastOutcome(collectRaycastHits(event))
    if (outcome.type === 'blocked') {
      onBlockedShot([event.point.x, event.point.y, event.point.z])
    }
    // A zombie/miss outcome here would mean this collider fired even though
    // it wasn't actually the nearest relevant hit — shouldn't happen given
    // R3F's dispatch order, but if it ever did, doing nothing is correct:
    // whichever hitbox truly is nearest already got (or will get) its own
    // pointerdown dispatch on this same event, since intersections are
    // computed once per event.
  }

  return (
    <mesh position={[cx, cy, cz]} userData={{ raycastKind: 'environment' }} onPointerDown={handlePointerDown}>
      <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
