import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PrimShape } from './prim_shape.pure.ui.tsx'
import { unitBoxGeometry } from './shared_geometry.pure.lib.ts'

describe('PrimShape', () => {
  it('draws the shared geometry with its colour and transform, and is never hit', async () => {
    const renderer = await ReactThreeTestRenderer.create(<PrimShape geometry={unitBoxGeometry} color="#ff0000" position={[1, 2, 3]} scale={[2, 1, 1]} emissive="#00ff00" />)
    const mesh = renderer.scene.children[0]?.instance
    if (!(mesh instanceof THREE.Mesh) || !(mesh.material instanceof THREE.MeshStandardMaterial)) throw new Error('expected a standard mesh')
    expect(mesh.geometry).toBe(unitBoxGeometry)
    expect(mesh.position.toArray()).toEqual([1, 2, 3])
    expect(mesh.scale.toArray()).toEqual([2, 1, 1])
    expect(mesh.material.color.getHexString()).toBe('ff0000')
    expect(mesh.material.emissive.getHexString()).toBe('00ff00')
    const hits: THREE.Intersection[] = []
    mesh.raycast(new THREE.Raycaster(new THREE.Vector3(1, 2, 10), new THREE.Vector3(0, 0, -1)), hits)
    expect(hits).toEqual([])
  })
})
