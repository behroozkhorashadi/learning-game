import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FAILING_MODEL_URLS } from '@app/zombies/drei_fake.test.lib.ts'
import { EQUATION_BLASTER_URL } from './blaster_config.pure.lib.ts'
import { EquationBlaster, type EquationBlasterProps } from './equation_blaster.pure.ui.tsx'
import { FINISH_LOOKS } from './blaster_finish.pure.lib.ts'
import { MEGA_BLASTER, RAPID_BLASTER, STARTER_BLASTER } from './weapon_definitions.pure.lib.ts'

vi.mock('@react-three/drei', async (importOriginal) => (await import('@app/zombies/drei_fake.test.lib.ts')).withFakeModels(await importOriginal<object>()))

afterEach(() => {
  FAILING_MODEL_URLS.clear()
  vi.restoreAllMocks()
})

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>

function props(overrides: Partial<EquationBlasterProps> = {}): EquationBlasterProps {
  return {
    weapon: STARTER_BLASTER,
    weaponPhase: 'readyFirstShot',
    cockingUntilMs: null,
    elapsedMs: 0,
    cockingMs: 900,
    recoilSignal: 0,
    aimNdc: null,
    reducedMotion: false,
    onReloadStart: vi.fn(),
    ...overrides,
  }
}

/** The camera-parented root, then: weapon root → aim group → recoil group. */
function recoilGroup(renderer: Renderer): THREE.Object3D | undefined {
  return renderer.scene.instance.children[0]?.children[0]?.children[0]?.children[0]?.children[0]
}

describe('EquationBlaster', () => {
  it('kicks back on a shot and settles to rest', async () => {
    const renderer = await ReactThreeTestRenderer.create(<EquationBlaster {...props()} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 1 / 60)
      await renderer.update(<EquationBlaster {...props({ recoilSignal: 1 })} />)
    })
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 0.01)
    })
    expect(recoilGroup(renderer)?.position.z).toBeGreaterThan(0)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(20, 0.05)
    })
    expect(recoilGroup(renderer)?.position.z).toBe(0)
  })

  it('starts the reload sound once per cocking, after the recoil has settled', async () => {
    const onReloadStart = vi.fn()
    const renderer = await ReactThreeTestRenderer.create(<EquationBlaster {...props({ onReloadStart })} />)
    const cocking = (elapsedMs: number) => <EquationBlaster {...props({ onReloadStart, weaponPhase: 'cocking', cockingUntilMs: 900, elapsedMs })} />
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(cocking(100))
    })
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 1 / 60)
    })
    expect(onReloadStart).not.toHaveBeenCalled()
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(cocking(400))
    })
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 1 / 60)
      await renderer.update(cocking(600))
    })
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 1 / 60)
    })
    expect(onReloadStart).toHaveBeenCalledTimes(1)
  })

  it('turns toward the crosshair', async () => {
    const renderer = await ReactThreeTestRenderer.create(<EquationBlaster {...props({ aimNdc: { x: 0.8, y: 0 } })} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(30, 1 / 60)
    })
    const aimGroup = recoilGroup(renderer)?.parent
    expect(aimGroup?.quaternion.y).not.toBe(0)
  })

  it('falls back to the placeholder gun, with a warning, when the model fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    FAILING_MODEL_URLS.add(EQUATION_BLASTER_URL)
    const renderer = await ReactThreeTestRenderer.create(<EquationBlaster {...props()} />)
    expect(renderer.scene.instance.getObjectByName('fallback-blaster')).toBeTruthy()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using the placeholder gun'))
  })

  it('hides an arm for dev calibration', async () => {
    const both = await ReactThreeTestRenderer.create(<EquationBlaster {...props()} />)
    const one = await ReactThreeTestRenderer.create(<EquationBlaster {...props({ hideLeftArm: true })} />)
    expect((recoilGroup(both)?.children.length ?? 0) - (recoilGroup(one)?.children.length ?? 0)).toBe(1)
  })

  it('dresses each better blaster in more parts, a glow that breathes, and a bigger flash in its own colour', async () => {
    const starter = await ReactThreeTestRenderer.create(<EquationBlaster {...props()} />)
    expect(starter.scene.instance.getObjectByName('blaster-finish')).toBeUndefined()

    for (const weapon of [RAPID_BLASTER, MEGA_BLASTER]) {
      const look = FINISH_LOOKS[weapon.finish]
      const renderer = await ReactThreeTestRenderer.create(<EquationBlaster {...props({ weapon })} />)
      expect(renderer.scene.instance.getObjectByName('blaster-finish')?.children).toHaveLength(look.parts.length)
      const light = renderer.scene.instance.getObjectByName('muzzle-light')
      expect(light instanceof THREE.PointLight && light.color.getHexString()).toBe(new THREE.Color(look.flashColor).getHexString())
    }

    const mega = await ReactThreeTestRenderer.create(<EquationBlaster {...props({ weapon: MEGA_BLASTER })} />)
    const glows: number[] = []
    for (let i = 0; i < 8; i++) {
      await ReactThreeTestRenderer.act(async () => {
        await mega.advanceFrames(1, 0.1)
      })
      const ring = mega.scene.instance.getObjectByName('blaster-part-ring')
      if (ring instanceof THREE.Mesh && ring.material instanceof THREE.MeshStandardMaterial) glows.push(ring.material.emissiveIntensity)
    }
    expect(glows).toHaveLength(8)
    expect(new Set(glows).size).toBeGreaterThan(1)
  })

  it('wears an emblem where it was put', async () => {
    const emblem = (onArm: boolean, onBlaster: boolean) => ({ imageUrl: '/art/a1.jpg', ringColor: '#FFAA00', onArm, onBlaster })
    const count = async (worn: ReturnType<typeof emblem> | null): Promise<number> => {
      const renderer = await ReactThreeTestRenderer.create(<EquationBlaster {...props({ emblem: worn })} />)
      let found = 0
      renderer.scene.instance.traverse((child) => {
        if (child.name === 'emblem') found++
      })
      return found
    }
    expect(await count(null)).toBe(0)
    expect(await count(emblem(true, false))).toBe(1)
    expect(await count(emblem(false, true))).toBe(1)
    expect(await count(emblem(true, true))).toBe(2)
    const renderer = await ReactThreeTestRenderer.create(<EquationBlaster {...props({ emblem: emblem(true, false) })} />)
    const badge = renderer.scene.instance.getObjectByName('emblem')
    let pictures = 0
    badge?.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial && child.material.map !== null) pictures++
    })
    expect(pictures).toBe(1)
  })

  it("paints the blaster in the kid's colour instead of its finish's", async () => {
    const colorOf = (renderer: Renderer): string | undefined => {
      let color: string | undefined
      renderer.scene.instance.traverse((child) => {
        if (color === undefined && child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial && child.material.emissive.getHex() !== 0) color = child.material.emissive.getHexString()
      })
      return color
    }
    const painted = await ReactThreeTestRenderer.create(<EquationBlaster {...props({ hideLeftArm: true, hideRightArm: true, blasterTint: { color: '#00FF88', amount: 0.7, glow: 0.12 } })} />)
    expect(colorOf(painted)).toBe('00ff88')
    const plain = await ReactThreeTestRenderer.create(<EquationBlaster {...props({ hideLeftArm: true, hideRightArm: true })} />)
    expect(colorOf(plain)).toBeUndefined()
  })
})
