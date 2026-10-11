import type { ThreeEvent } from '@react-three/fiber'
import type { ReactElement } from 'react'
import { resolveRaycastOutcome } from '@app/arena/raycast_outcome.pure.lib.ts'
import { ENVIRONMENT_USER_DATA, classifyIntersections } from '@app/arena/raycast_tags.pure.lib.ts'
import type { EnvironmentCollider as ColliderData } from './environment_colliders.pure.lib.ts'

/**
 * The invisible hit volume of a solid environment object: exactly the box
 * `environment_colliders` collides with (same data), not the decorative mesh
 * drawn beside it. Invisible by a fully transparent material rather than
 * `visible={false}`, because an invisible mesh isn't raycast.
 *
 * Blocking: R3F dispatches pointer events nearest-object-first, and every
 * tagged handler stops propagation. This handler still re-derives the true
 * nearest relevant hit from the event's full intersection list with
 * `resolveRaycastOutcome`, so the live scene and that function's tests follow
 * the same rule.
 */

export interface EnvironmentColliderProps {
  readonly collider: ColliderData
  readonly onBlockedShot: (point: readonly [number, number, number]) => void
}

export function EnvironmentCollider({ collider, onBlockedShot }: EnvironmentColliderProps): ReactElement {
  const [cx, cy, cz] = collider.center
  const [hx, hy, hz] = collider.halfExtents

  function handlePointerDown(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation()
    // A zombie or miss outcome would mean this fired without being the nearest relevant hit; that target gets its own dispatch, so doing nothing is right.
    if (resolveRaycastOutcome(classifyIntersections(event.intersections)).type === 'blocked') onBlockedShot([event.point.x, event.point.y, event.point.z])
  }

  return (
    <mesh name={`collider-${collider.id}`} position={[cx, cy, cz]} userData={ENVIRONMENT_USER_DATA} onPointerDown={handlePointerDown}>
      <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
