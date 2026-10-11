import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { readRaycastTag } from '@app/arena/raycast_tags.pure.lib.ts'
import { HordeEnvironment } from './horde_environment.pure.ui.tsx'
import { COVER } from './horde_field.pure.lib.ts'

describe('HordeEnvironment', () => {
  it('gives every piece of cover an environment collider of exactly its size, where it stands', async () => {
    const renderer = await ReactThreeTestRenderer.create(<HordeEnvironment cover={COVER} shadows={false} />)
    for (const piece of COVER) {
      const collider = renderer.scene.instance.getObjectByName(`collider-${piece.id}`)
      if (!(collider instanceof THREE.Mesh)) throw new Error(`no collider for ${piece.id}`)
      expect(readRaycastTag(collider).raycastKind).toBe('environment')
      const size = new THREE.Box3().setFromObject(collider).getSize(new THREE.Vector3())
      expect(size.x).toBeCloseTo(piece.halfWidth * 2, 5)
      expect(size.y).toBeCloseTo(piece.height, 5)
      const centre = collider.getWorldPosition(new THREE.Vector3())
      expect(centre.x).toBeCloseTo(piece.x, 5)
      expect(centre.z).toBeCloseTo(-piece.depth, 5)
    }
  })

  it('has a floor grenades can land on, which shots ignore', async () => {
    const renderer = await ReactThreeTestRenderer.create(<HordeEnvironment cover={[]} shadows={false} />)
    const floor = renderer.scene.instance.getObjectByName('floor')
    if (floor === undefined) throw new Error('no floor')
    expect(readRaycastTag(floor).raycastKind).toBe('debug')
  })
})
