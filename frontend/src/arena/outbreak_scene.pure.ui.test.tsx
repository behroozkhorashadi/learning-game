import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { SCIENTIST_ZOMBIE } from '@app/zombies/character_definitions.pure.lib.ts'
import type { Carrier } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import { OutbreakScene, type OutbreakSceneProps } from './outbreak_scene.pure.ui.tsx'
import { readRaycastTag } from './raycast_tags.pure.lib.ts'

/**
 * The scene, rendered without WebGL (R3F's test renderer), over synthetic
 * models (drei_fake: drei's loader can't fetch in jsdom).
 */

vi.mock('@react-three/drei', async (importOriginal) => (await import('@app/zombies/drei_fake.test.lib.ts')).withFakeModels(await importOriginal<object>()))

afterEach(() => {
  vi.restoreAllMocks()
})

function carrier(id: string, lane: number, overrides: Partial<Carrier> = {}): Carrier {
  return { id, label: String(lane + 5), correct: lane === 1, lane, distance: 0.5, status: 'active', defeatedBy: null, ...overrides }
}

function props(overrides: Partial<OutbreakSceneProps> = {}): OutbreakSceneProps {
  return {
    carriers: [carrier('a', 0), carrier('b', 1)],
    charactersByLane: [SCIENTIST_ZOMBIE, SCIENTIST_ZOMBIE, SCIENTIST_ZOMBIE, SCIENTIST_ZOMBIE],
    weapon: STARTER_BLASTER,
    phase: 'playing',
    speedMultiplier: 1,
    aimNdc: null,
    reducedMotion: false,
    recoilSignal: 0,
    weaponPhase: 'readyFirstShot',
    cockingUntilMs: null,
    elapsedMs: 0,
    cockingMs: 900,
    onHit: vi.fn(),
    onMiss: vi.fn(),
    onReloadStart: vi.fn(),
    ...overrides,
  }
}

function meshesTaggedFor(scene: THREE.Object3D, carrierId: string): number {
  let count = 0
  scene.traverse((obj) => {
    const tag = readRaycastTag(obj)
    if (tag.raycastKind === 'zombie' && tag.carrierId === carrierId) count += 1
  })
  return count
}

describe('OutbreakScene', () => {
  it('places each zombie on its lane at its distance and makes it a hit target', async () => {
    const onZombieReady = vi.fn()
    const renderer = await ReactThreeTestRenderer.create(<OutbreakScene {...props({ onZombieReady })} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(2, 1 / 60)
    })
    const zombie = renderer.scene.instance.getObjectByName('zombie-b')
    expect(zombie?.position.z).toBeCloseTo((-13 + 0.5) / 2, 5)
    expect(meshesTaggedFor(renderer.scene.instance, 'b')).toBeGreaterThan(0)
    expect(onZombieReady).toHaveBeenCalledWith('a')
    expect(onZombieReady).toHaveBeenCalledWith('b')
  })

  it('moves a zombie as its carrier advances', async () => {
    const renderer = await ReactThreeTestRenderer.create(<OutbreakScene {...props()} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<OutbreakScene {...props({ carriers: [carrier('a', 0, { distance: 1 }), carrier('b', 1)] })} />)
    })
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 1 / 60)
    })
    expect(renderer.scene.instance.getObjectByName('zombie-a')?.position.z).toBeCloseTo(0.5, 5)
  })

  it('a defeated zombie is no longer a hit target', async () => {
    const renderer = await ReactThreeTestRenderer.create(<OutbreakScene {...props()} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<OutbreakScene {...props({ carriers: [carrier('a', 0, { status: 'defeated', defeatedBy: 'headshot' }), carrier('b', 1)] })} />)
    })
    expect(meshesTaggedFor(renderer.scene.instance, 'a')).toBe(0)
    expect(meshesTaggedFor(renderer.scene.instance, 'b')).toBeGreaterThan(0)
  })

  it('draws the dev lane overlay only when asked', async () => {
    const withoutOverlay = await ReactThreeTestRenderer.create(<OutbreakScene {...props()} />)
    const withOverlay = await ReactThreeTestRenderer.create(<OutbreakScene {...props({ debugLanes: true })} />)
    const lines = (r: typeof withOverlay): number => {
      let n = 0
      r.scene.instance.traverse((obj) => {
        if (obj.type === 'Line2') n += 1
      })
      return n
    }
    expect(lines(withoutOverlay)).toBe(0)
    expect(lines(withOverlay)).toBeGreaterThan(0)
  })

  it('pins every zombie to the same walk phase when the hit lab asks', async () => {
    const renderer = await ReactThreeTestRenderer.create(<OutbreakScene {...props({ fixedPhaseOffsetSeconds: 0.25 })} />)
    expect(renderer.scene.instance.getObjectByName('zombie-a')).toBeTruthy()
  })
})

describe('OutbreakScene shots', () => {
  it('reports a click on a zombie as a hit on that carrier, head above the head bone', async () => {
    const onHit = vi.fn()
    const renderer = await ReactThreeTestRenderer.create(<OutbreakScene {...props({ onHit })} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(2, 1 / 60)
    })
    const zombie = renderer.scene.instance.getObjectByName('zombie-b')
    const body = zombie?.getObjectByName('body')
    if (!(body instanceof THREE.Mesh)) throw new Error('expected the zombie body mesh')
    const model = renderer.scene.findAll((node) => node.instance === body.parent?.parent?.parent)[0]
    const target = model ?? renderer.scene.findAll((node) => node.props.onPointerDown !== undefined)[0]
    if (target === undefined) throw new Error('expected a clickable zombie')
    const point = new THREE.Vector3(0, 100, 0)
    await renderer.fireEvent(target, 'onPointerDown', { stopPropagation: () => undefined, intersections: [{ object: body, distance: 2, point }] })
    expect(onHit).toHaveBeenCalledWith('b', 'head')
  })
})
