import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { resolveRaycastOutcome } from '@app/arena/raycast_outcome.pure.lib.ts'
import { ENVIRONMENT_USER_DATA } from '@app/arena/raycast_tags.pure.lib.ts'
import { classifyHordeIntersections, tagHordeMesh } from './horde_raycast.pure.lib.ts'

function hit(object: THREE.Object3D, distance: number): THREE.Intersection {
  return { object, distance, point: new THREE.Vector3(0, 1, 0) }
}

describe('horde raycast tags', () => {
  it('classifies a tagged zombie mesh with its zone, cover as environment, and anything else as ignorable', () => {
    const zombie = new THREE.Mesh()
    tagHordeMesh(zombie, { zombieId: 'z1', zoneAt: (point) => (point.y > 0.5 ? 'head' : 'leg') })
    const cover = new THREE.Mesh()
    cover.userData = ENVIRONMENT_USER_DATA
    const floor = new THREE.Mesh()
    expect(classifyHordeIntersections([hit(zombie, 3), hit(cover, 2), hit(floor, 1)])).toEqual([
      { kind: 'zombie', distance: 3, meta: { zombieId: 'z1', zone: 'head' } },
      { kind: 'environment', distance: 2 },
      { kind: 'debug', distance: 1 },
    ])
  })

  it('cover in front blocks a zombie behind it; the floor never does', () => {
    const zombie = new THREE.Mesh()
    tagHordeMesh(zombie, { zombieId: 'z1', zoneAt: () => 'body' })
    const cover = new THREE.Mesh()
    cover.userData = ENVIRONMENT_USER_DATA
    expect(resolveRaycastOutcome(classifyHordeIntersections([hit(zombie, 5), hit(cover, 2)])).type).toBe('blocked')
    expect(resolveRaycastOutcome(classifyHordeIntersections([hit(zombie, 5), hit(new THREE.Mesh(), 2)]))).toEqual({ type: 'zombie', meta: { zombieId: 'z1', zone: 'body' } })
  })

  it('an untagged mesh is no longer a target', () => {
    const zombie = new THREE.Mesh()
    tagHordeMesh(zombie, { zombieId: 'z1', zoneAt: () => 'body' })
    tagHordeMesh(zombie, null)
    expect(classifyHordeIntersections([hit(zombie, 1)])).toEqual([{ kind: 'debug', distance: 1 }])
  })
})
