import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ENVIRONMENT_USER_DATA, classifyIntersections, readRaycastTag, tagZombieMesh } from './raycast_tags.pure.lib.ts'

function intersection(object: THREE.Object3D, distance: number, y = 0): THREE.Intersection {
  return { object, distance, point: new THREE.Vector3(0, y, 0) }
}

describe('raycast tags', () => {
  it('reads a tagged zombie mesh, an environment collider, and anything else as debug', () => {
    const zombie = new THREE.Mesh()
    const collider = new THREE.Mesh()
    collider.userData = ENVIRONMENT_USER_DATA
    tagZombieMesh(zombie, { carrierId: 'c1', zoneAt: () => 'body' })
    expect(readRaycastTag(zombie)).toMatchObject({ raycastKind: 'zombie', carrierId: 'c1' })
    expect(readRaycastTag(collider)).toEqual({ raycastKind: 'environment' })
    expect(readRaycastTag(new THREE.Mesh())).toEqual({ raycastKind: 'debug' })
  })

  it('untags a mesh, e.g. once its carrier is defeated', () => {
    const zombie = new THREE.Mesh()
    tagZombieMesh(zombie, { carrierId: 'c1', zoneAt: () => 'body' })
    tagZombieMesh(zombie, null)
    expect(readRaycastTag(zombie)).toEqual({ raycastKind: 'debug' })
  })

  it('classifies every intersection, asking the zombie which zone the point is in', () => {
    const zombie = new THREE.Mesh()
    tagZombieMesh(zombie, { carrierId: 'c2', zoneAt: (point) => (point.y > 1.5 ? 'head' : 'body') })
    const collider = new THREE.Mesh()
    collider.userData = ENVIRONMENT_USER_DATA
    expect(classifyIntersections([intersection(zombie, 3, 2), intersection(zombie, 3.1, 1), intersection(collider, 5), intersection(new THREE.Mesh(), 1)])).toEqual([
      { kind: 'zombie', distance: 3, meta: { carrierId: 'c2', zone: 'head' } },
      { kind: 'zombie', distance: 3.1, meta: { carrierId: 'c2', zone: 'body' } },
      { kind: 'environment', distance: 5 },
      { kind: 'debug', distance: 1 },
    ])
  })
})
