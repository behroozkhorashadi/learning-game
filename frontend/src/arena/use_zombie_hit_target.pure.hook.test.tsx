import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useRef, type ReactElement } from 'react'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildLanes } from './lane_navigation.pure.lib.ts'
import { readRaycastTag } from './raycast_tags.pure.lib.ts'
import { useZombieHitTarget } from './use_zombie_hit_target.pure.hook.ts'

const LANE = buildLanes()[2]
if (LANE === undefined) throw new Error('need lane 2')
const lane = LANE

function Target({ distance, canBeHit, head }: { readonly distance: number; readonly canBeHit: boolean; readonly head: THREE.Object3D | null }): ReactElement {
  const group = useRef<THREE.Group>(null)
  const model = useRef<THREE.Group>(null)
  useZombieHitTarget(group, model, { lane, distance, carrierId: 'c1', canBeHit, headBone: head, rigVersion: 1 })
  return (
    <group ref={group} name="zombie">
      <group ref={model}>
        <mesh name="body" />
      </group>
    </group>
  )
}

function bodyOf(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): THREE.Object3D {
  const body = renderer.scene.instance.getObjectByName('body')
  if (body === undefined) throw new Error('no body')
  return body
}

describe('useZombieHitTarget', () => {
  it('stands the zombie on its lane at its distance, and follows it', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Target distance={0} canBeHit head={null} />)
    expect(renderer.scene.instance.getObjectByName('zombie')?.position.toArray()).toEqual([...lane.spawn])
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<Target distance={1} canBeHit head={null} />)
    })
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 1 / 60)
    })
    expect(renderer.scene.instance.getObjectByName('zombie')?.position.toArray()).toEqual([...lane.playerBoundary])
  })

  it('tags the model while hittable, splitting head from body at the head bone, and untags it after', async () => {
    const head = new THREE.Object3D()
    head.position.y = 1.5
    const renderer = await ReactThreeTestRenderer.create(<Target distance={0.5} canBeHit head={head} />)
    const tag = readRaycastTag(bodyOf(renderer))
    if (tag.raycastKind !== 'zombie') throw new Error('expected a zombie tag')
    head.updateMatrixWorld()
    expect([tag.zoneAt(new THREE.Vector3(0, 2, 0)), tag.zoneAt(new THREE.Vector3(0, 1, 0))]).toEqual(['head', 'body'])
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<Target distance={0.5} canBeHit={false} head={head} />)
    })
    expect(readRaycastTag(bodyOf(renderer)).raycastKind).toBe('debug')
  })

  it('calls every shot a body shot before the head bone is known', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Target distance={0.5} canBeHit head={null} />)
    const tag = readRaycastTag(bodyOf(renderer))
    expect(tag.raycastKind === 'zombie' ? tag.zoneAt(new THREE.Vector3(0, 99, 0)) : null).toBe('body')
  })
})
