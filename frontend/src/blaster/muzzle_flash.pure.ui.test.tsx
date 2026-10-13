import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { MuzzleFlash } from './muzzle_flash.pure.ui.tsx'

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>

function named<T extends THREE.Object3D>(renderer: Renderer, name: string, type: new () => T): T {
  const found = renderer.scene.instance.getObjectByName(name)
  if (!(found instanceof type)) throw new Error(`no ${name}`)
  return found
}

describe('MuzzleFlash', () => {
  it('is dark until a shot, flashes for one shot, then goes fully dark again', async () => {
    const renderer = await ReactThreeTestRenderer.create(<MuzzleFlash triggerSignal={0} reducedMotion={false} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(2, 1 / 60)
    })
    const flash = named(renderer, 'muzzle-flash', THREE.Sprite)
    const light = named(renderer, 'muzzle-light', THREE.PointLight)
    expect(flash.visible).toBe(false)
    expect(light.intensity).toBe(0)

    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<MuzzleFlash triggerSignal={1} reducedMotion={false} />)
    })
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 0.001)
    })
    expect(flash.visible).toBe(true)
    expect(light.intensity).toBeGreaterThan(0)

    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(10, 0.02)
    })
    expect(flash.visible).toBe(false)
    expect(light.intensity).toBe(0)
    renderer.scene.instance.traverse((obj) => {
      if (obj.name === 'muzzle-spark') expect(obj.visible).toBe(false)
    })
  })

  it('takes the weapon\'s colour and size', async () => {
    async function flashAfterShot(extra: { readonly color?: string; readonly sizeScale?: number }): Promise<{ readonly scale: number; readonly color: THREE.Color; readonly light: THREE.Color }> {
      const renderer = await ReactThreeTestRenderer.create(<MuzzleFlash triggerSignal={0} reducedMotion={false} seed={7} {...extra} />)
      await ReactThreeTestRenderer.act(async () => {
        await renderer.update(<MuzzleFlash triggerSignal={1} reducedMotion={false} seed={7} {...extra} />)
      })
      await ReactThreeTestRenderer.act(async () => {
        await renderer.advanceFrames(1, 0.02)
      })
      const flash = named(renderer, 'muzzle-flash', THREE.Sprite)
      return { scale: flash.scale.x, color: flash.material.color, light: named(renderer, 'muzzle-light', THREE.PointLight).color }
    }
    const plain = await flashAfterShot({})
    const mega = await flashAfterShot({ color: '#FF9CF9', sizeScale: 1.7 })
    expect(mega.scale).toBeCloseTo(plain.scale * 1.7)
    expect(plain.color.getHexString()).toBe('ffffff')
    expect(mega.color.getHexString()).toBe(new THREE.Color('#FF9CF9').getHexString())
    expect(mega.light.getHexString()).toBe(new THREE.Color('#FF9CF9').getHexString())
  })
})
