import type { ReactNode } from 'react'
import type { PropPlacement } from '../lib/environmentLayout'
import { EnvironmentCollider } from './EnvironmentCollider'

/**
 * Pairs one prop's decorative geometry with its (invisible, world-aligned)
 * collider, both driven by the same `PropPlacement` so they can never
 * disagree about where the prop actually is. `children` is free to rotate
 * for looks — the collider always stays axis-aligned in world space,
 * because `placement.halfExtents` is already authored to account for
 * `rotationY` (see the docstring in `environmentLayout.ts`).
 */
interface Props {
  placement: PropPlacement
  onBlockedShot: (point: readonly [number, number, number]) => void
  children: ReactNode
}

export function EnvironmentProp({ placement, onBlockedShot, children }: Props) {
  return (
    <>
      <group position={placement.position} rotation={[0, placement.rotationY, 0]}>
        {children}
      </group>
      <EnvironmentCollider collider={{ id: placement.id, center: placement.position, halfExtents: placement.halfExtents }} onBlockedShot={onBlockedShot} />
    </>
  )
}
