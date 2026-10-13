import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { disableRaycastRecursively, tintMaterials } from './scene_graph.pure.lib.ts'

describe('disableRaycastRecursively', () => {
  it('stops every mesh in the subtree from reporting an intersection', () => {
    const root = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry())
    root.add(new THREE.Group().add(mesh))
    disableRaycastRecursively(root)
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1))
    expect(raycaster.intersectObject(root, true)).toEqual([])
  })
})

describe('tintMaterials', () => {
  it('mixes each standard material toward the tint and glows it, on a copy, leaving the original alone', () => {
    const shared = new THREE.MeshStandardMaterial({ color: '#000000' })
    const original = new THREE.Mesh(new THREE.BoxGeometry(), shared)
    const copy = original.clone()
    const other = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: '#123456' }))
    const root = new THREE.Group().add(copy, other)
    tintMaterials(root, { color: '#FF0000', amount: 0.5, glow: 0.3 })
    if (!(copy.material instanceof THREE.MeshStandardMaterial)) throw new Error('lost its standard material')
    expect(copy.material).not.toBe(shared)
    expect(copy.material.color.r).toBeCloseTo(0.5)
    expect(copy.material.emissive.getHexString()).toBe('ff0000')
    expect(copy.material.emissiveIntensity).toBe(0.3)
    expect(shared.color.getHexString()).toBe('000000')
    expect(other.material.color.getHexString()).toBe('123456')
  })
})
