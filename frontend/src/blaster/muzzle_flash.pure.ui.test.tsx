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
})
