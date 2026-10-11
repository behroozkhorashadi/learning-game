import ReactThreeTestRenderer from '@react-three/test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { EnvironmentProp } from './environment_prop.pure.ui.tsx'

describe('EnvironmentProp', () => {
  it('draws the prop rotated at its placement, with an axis-aligned collider at the same spot', async () => {
    const placement = { id: 'locker', kind: 'locker' as const, position: [2, 0.6, -14] as const, rotationY: Math.PI / 2, halfExtents: [1, 0.6, 0.3] as const }
    const renderer = await ReactThreeTestRenderer.create(
      <EnvironmentProp placement={placement} onBlockedShot={vi.fn()}>
        <mesh name="decoration" />
      </EnvironmentProp>,
    )
    const decoration = renderer.scene.instance.getObjectByName('decoration')?.parent
    const collider = renderer.scene.instance.getObjectByName('collider-locker')
    expect(decoration?.position.toArray()).toEqual([2, 0.6, -14])
    expect(decoration?.rotation.y).toBeCloseTo(Math.PI / 2)
    expect(collider?.position.toArray()).toEqual([2, 0.6, -14])
    expect(collider?.rotation.y).toBe(0)
  })
})
