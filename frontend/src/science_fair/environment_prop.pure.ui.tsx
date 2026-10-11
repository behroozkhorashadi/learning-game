import type { ReactNode, ReactElement } from 'react'
import type { PropPlacement } from './environment_layout.pure.lib.ts'
import { EnvironmentCollider } from './environment_collider.pure.ui.tsx'

/**
 * Pairs one prop's decorative geometry with its (invisible, world-aligned)
 * collider, both driven by the same `PropPlacement` so they can never
 * disagree about where the prop actually is. `children` is free to rotate
 * for looks — the collider always stays axis-aligned in world space,
 * because `placement.halfExtents` is already authored to account for
 * `rotationY` (see the docstring in `environmentLayout.ts`).
 */
export interface EnvironmentPropProps {
  readonly placement: PropPlacement
  readonly onBlockedShot: (point: readonly [number, number, number]) => void
  readonly children: ReactNode
}

export function EnvironmentProp({ placement, onBlockedShot, children }: EnvironmentPropProps): ReactElement {
  return (
    <>
      <group position={placement.position} rotation={[0, placement.rotationY, 0]}>
        {children}
      </group>
      <EnvironmentCollider collider={{ id: placement.id, center: placement.position, halfExtents: placement.halfExtents }} onBlockedShot={onBlockedShot} />
    </>
  )
}
