import ReactThreeTestRenderer from '@react-three/test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { SCIENTIST_ZOMBIE } from './character_definitions.pure.lib.ts'
import { ZombieCharacter3D } from './zombie_character_3d.pure.ui.tsx'

vi.mock('@react-three/drei', async (importOriginal) => (await import('./drei_fake.test.lib.ts')).withFakeModels(await importOriginal<object>()))

/** One zombie from a (synthetic) GLB: its own skeleton clone, its bones, its clips. */

describe('ZombieCharacter3D', () => {
  it('reports its head and torso bones', async () => {
    const onBonesReady = vi.fn()
    await ReactThreeTestRenderer.create(<ZombieCharacter3D character={SCIENTIST_ZOMBIE} clipRole="idle" onBonesReady={onBonesReady} />)
    const bones: unknown = onBonesReady.mock.calls[0]?.[0]
    expect(bones).toMatchObject({ head: { name: SCIENTIST_ZOMBIE.headBoneName }, torso: { name: SCIENTIST_ZOMBIE.torsoBoneName } })
  })

  it('poses its own clone: the shared model is never animated', async () => {
    const renderer = await ReactThreeTestRenderer.create(<ZombieCharacter3D character={SCIENTIST_ZOMBIE} clipRole="approach" />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(10, 0.05)
    })
    const head = renderer.scene.instance.getObjectByName(SCIENTIST_ZOMBIE.headBoneName)
    expect(head?.quaternion.y).not.toBe(0)
  })

  it('uses the character scale and ground offset', async () => {
    const renderer = await ReactThreeTestRenderer.create(<ZombieCharacter3D character={SCIENTIST_ZOMBIE} clipRole="idle" />)
    const group = renderer.scene.children[0]?.instance
    expect(group?.scale.x).toBe(SCIENTIST_ZOMBIE.scale)
    expect(group?.position.y).toBe(SCIENTIST_ZOMBIE.yOffset)
  })
})

describe('preloadZombieModels', () => {
  it('starts loading every enabled character', async () => {
    const { preloadZombieModels } = await import('./zombie_character_3d.pure.ui.tsx')
    expect(() => {
      preloadZombieModels([SCIENTIST_ZOMBIE])
    }).not.toThrow()
  })
})
