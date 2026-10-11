import ReactThreeTestRenderer from '@react-three/test-renderer'
import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ENVIRONMENT_COLLIDERS } from '@app/science_fair/environment_colliders.pure.lib.ts'
import { DEFAULT_LANES } from './lane_navigation.pure.lib.ts'
import { LaneDebugOverlay } from './lane_debug_overlay.pure.ui.tsx'

function count(root: THREE.Object3D, type: string): number {
  let n = 0
  root.traverse((obj) => {
    if (obj.type === type) n += 1
  })
  return n
}

describe('LaneDebugOverlay', () => {
  it('draws each lane path and corridor, every collider box, and each active carrier', async () => {
    const renderer = await ReactThreeTestRenderer.create(<LaneDebugOverlay lanes={DEFAULT_LANES} activeCarrierPositions={[{ lane: 1, position: [0, 0, -5] }]} />)
    // Two lines per lane (path, corridor); six per collider box (top, bottom, four edges).
    expect(count(renderer.scene.instance, 'Line2')).toBe(DEFAULT_LANES.length * 2 + ENVIRONMENT_COLLIDERS.length * 6)
    // A spawn and a boundary marker per lane, plus the carrier.
    expect(count(renderer.scene.instance, 'Mesh')).toBe(DEFAULT_LANES.length * 2 + 1)
  })

  it('is never a hit target', async () => {
    const renderer = await ReactThreeTestRenderer.create(<LaneDebugOverlay lanes={DEFAULT_LANES} activeCarrierPositions={[]} />)
    renderer.scene.instance.traverse((obj) => {
      expect(obj.userData).not.toHaveProperty('raycastKind')
    })
  })
})
