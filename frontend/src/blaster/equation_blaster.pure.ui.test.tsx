import ReactThreeTestRenderer from '@react-three/test-renderer'
import type * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FAILING_MODEL_URLS } from '@app/zombies/drei_fake.test.lib.ts'
import { EQUATION_BLASTER_URL } from './blaster_config.pure.lib.ts'
import { EquationBlaster, type EquationBlasterProps } from './equation_blaster.pure.ui.tsx'
import { STARTER_BLASTER } from './weapon_definitions.pure.lib.ts'

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
})
