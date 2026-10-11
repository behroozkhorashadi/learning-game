import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useRef, type ReactElement } from 'react'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { classifyHordeIntersections } from './horde_raycast.pure.lib.ts'
import { useHordeZombieTarget, type HordeZombieTargetOptions } from './use_horde_zombie_target.pure.hook.ts'

/** A zombie stand-in: a body mesh with a head bone above a hips bone. */
function Target(options: Omit<HordeZombieTargetOptions, 'headBone' | 'hipsBone' | 'rigVersion'> & { readonly head: THREE.Object3D; readonly hips: THREE.Object3D }): ReactElement {
  const group = useRef<THREE.Group>(null)
  const model = useRef<THREE.Group>(null)
  useHordeZombieTarget(group, model, { ...options, headBone: options.head, hipsBone: options.hips, rigVersion: 1 })
  return (
    <group ref={group} name="target">
      <group ref={model}>
        <mesh name="body">
          <boxGeometry args={[0.5, 2, 0.5]} />
        </mesh>
        <primitive object={options.head} />
        <primitive object={options.hips} />
      </group>
    </group>
  )
}

function bones(): { readonly head: THREE.Object3D; readonly hips: THREE.Object3D } {
  const head = new THREE.Object3D()
  head.position.y = 1.6
  const hips = new THREE.Object3D()
  hips.position.y = 1
  return { head, hips }
}

function zoneOf(mesh: THREE.Object3D, y: number): string | null {
  const [hit] = classifyHordeIntersections([{ object: mesh, distance: 1, point: new THREE.Vector3(0, y, 0) }])
  return hit?.kind === 'zombie' ? hit.meta.zone : null
}

describe('useHordeZombieTarget', () => {
  it('starts at the field position, then eases toward a new one and turns to its heading', async () => {
    const parts = bones()
    const renderer = await ReactThreeTestRenderer.create(<Target zombieId="z1" x={2} depth={8} heading={0} canBeHit {...parts} />)
    const group = renderer.scene.instance.getObjectByName('target')
    expect([group?.position.x, group?.position.z]).toEqual([2, -8])
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<Target zombieId="z1" x={3} depth={6} heading={0.5} canBeHit {...parts} />)
    })
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(60, 1 / 60)
    })
    expect(group?.position.x).toBeCloseTo(3, 3)
    expect(group?.position.z).toBeCloseTo(-6, 3)
    expect(group?.rotation.y).toBeCloseTo(0.5, 2)
  })

  it('tags the model with head, body, and leg zones while it can be hit', async () => {
    const parts = bones()
    const renderer = await ReactThreeTestRenderer.create(<Target zombieId="z1" x={0} depth={0} heading={0} canBeHit {...parts} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 1 / 60)
    })
    const body = renderer.scene.instance.getObjectByName('body')
    if (body === undefined) throw new Error('no body')
    expect([zoneOf(body, 1.8), zoneOf(body, 1.3), zoneOf(body, 0.3)]).toEqual(['head', 'body', 'leg'])
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<Target zombieId="z1" x={0} depth={0} heading={0} canBeHit={false} {...parts} />)
    })
    expect(zoneOf(body, 1.8)).toBeNull()
  })
})
