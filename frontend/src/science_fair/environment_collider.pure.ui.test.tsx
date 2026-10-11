import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { tagZombieMesh } from '@app/arena/raycast_tags.pure.lib.ts'
import { EnvironmentCollider } from './environment_collider.pure.ui.tsx'

const COLLIDER = { id: 'booth', center: [1, 1, -4] as const, halfExtents: [0.5, 0.5, 0.5] as const }

async function shoot(intersections: readonly THREE.Intersection[]) {
  const onBlockedShot = vi.fn()
  const renderer = await ReactThreeTestRenderer.create(<EnvironmentCollider collider={COLLIDER} onBlockedShot={onBlockedShot} />)
  const box = renderer.scene.children[0]
  if (box === undefined) throw new Error('no collider')
  await renderer.fireEvent(box, 'onPointerDown', { stopPropagation: () => undefined, intersections, point: new THREE.Vector3(1, 1, -3.5) })
  return { onBlockedShot, box: box.instance }
}

describe('EnvironmentCollider', () => {
  it('is an invisible box, the size of the collider, that shots can still hit', async () => {
    const renderer = await ReactThreeTestRenderer.create(<EnvironmentCollider collider={COLLIDER} onBlockedShot={vi.fn()} />)
    const box = renderer.scene.children[0]?.instance
    if (!(box instanceof THREE.Mesh) || !(box.material instanceof THREE.MeshBasicMaterial)) throw new Error('expected a mesh')
    expect(box.visible).toBe(true)
    expect(box.material.opacity).toBe(0)
    expect(box.position.toArray()).toEqual([1, 1, -4])
  })

  it('blocks a shot when it is the nearest thing hit', async () => {
    const collider = new THREE.Mesh()
    collider.userData = { raycastKind: 'environment' }
    const { onBlockedShot } = await shoot([{ object: collider, distance: 3, point: new THREE.Vector3() }])
    expect(onBlockedShot).toHaveBeenCalledWith([1, 1, -3.5])
  })

  it('lets the shot through when a zombie is nearer', async () => {
    const zombie = new THREE.Mesh()
    tagZombieMesh(zombie, { carrierId: 'c', zoneAt: () => 'body' })
    const collider = new THREE.Mesh()
    collider.userData = { raycastKind: 'environment' }
    const { onBlockedShot } = await shoot([
      { object: collider, distance: 4, point: new THREE.Vector3() },
      { object: zombie, distance: 2, point: new THREE.Vector3() },
    ])
    expect(onBlockedShot).not.toHaveBeenCalled()
  })
})
