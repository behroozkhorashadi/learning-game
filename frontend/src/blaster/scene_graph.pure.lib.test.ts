import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { disableRaycastRecursively } from './scene_graph.pure.lib.ts'

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
