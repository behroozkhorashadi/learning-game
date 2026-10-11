import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useMemo, type ReactElement } from 'react'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SCIENTIST_ZOMBIE } from './character_definitions.pure.lib.ts'
import type { ZombieClipRole } from './zombie_animation_fallback.pure.lib.ts'
import { useZombieRig } from './use_zombie_rig.pure.hook.ts'
import { fakeZombieGltf } from './zombie_gltf_fixture.test.lib.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

const COMPLETE = fakeZombieGltf(SCIENTIST_ZOMBIE)
const NO_DEATH_CLIP = fakeZombieGltf(SCIENTIST_ZOMBIE, { missingClips: [SCIENTIST_ZOMBIE.clips.deadHeadshot] })

function Rig({ role, speed = 1, model = COMPLETE }: { readonly role: ZombieClipRole; readonly speed?: number; readonly model?: typeof COMPLETE }): ReactElement {
  const cloned = useMemo(() => cloneSkeleton(model.scene), [model])
  useZombieRig({ cloned, animations: model.animations, character: SCIENTIST_ZOMBIE, clipRole: role, speed, phaseOffsetSeconds: 0, onBonesReady: undefined })
  return <primitive object={cloned} />
}

describe('useZombieRig', () => {
  it('plays the clip for the role, advancing with the render loop', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Rig role="approach" />)
    const head = renderer.scene.instance.getObjectByName(SCIENTIST_ZOMBIE.headBoneName)
    const before = head?.quaternion.y
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(5, 0.1)
    })
    expect(head?.quaternion.y).not.toBe(before)
  })

  it('warns and holds a still pose for a missing one-shot clip', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const renderer = await ReactThreeTestRenderer.create(<Rig role="deadHeadshot" model={NO_DEATH_CLIP} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(5, 0.1)
    })
    // (The test renderer adds three's own THREE.Clock deprecation notice.)
    expect(warn.mock.calls.filter(([message]) => String(message).includes('holding a stationary pose'))).toHaveLength(1)
    expect(renderer.scene.instance.getObjectByName(SCIENTIST_ZOMBIE.headBoneName)?.quaternion.y).toBe(0)
  })

  it('changes speed without restarting the clip', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Rig role="approach" speed={1} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(3, 0.1)
      await renderer.update(<Rig role="approach" speed={0} />)
    })
    const head = renderer.scene.instance.getObjectByName(SCIENTIST_ZOMBIE.headBoneName)
    const frozen = head?.quaternion.y
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(3, 0.1)
    })
    expect(frozen).not.toBe(0)
    expect(head?.quaternion.y).toBe(frozen)
  })

  it('plays the get-up backwards: from the fall\'s last frame toward its first', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Rig role="getUp" />)
    const head = renderer.scene.instance.getObjectByName(SCIENTIST_ZOMBIE.headBoneName)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 0.01)
    })
    const start = head?.quaternion.y ?? 0
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(5, 0.1)
    })
    expect(start).toBeGreaterThan(0.09)
    expect(head?.quaternion.y ?? 1).toBeLessThan(start)
  })
})
