import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { createRound, type HordeZombie } from './horde_engine.pure.lib.ts'
import { COVER } from './horde_field.pure.lib.ts'
import { classifyHordeIntersections } from './horde_raycast.pure.lib.ts'
import { HordeScene, type HordeSceneProps } from './horde_scene.pure.ui.tsx'

/**
 * The scene, rendered without WebGL (R3F's test renderer), over synthetic
 * models (drei_fake: drei's loader can't fetch in jsdom).
 */

vi.mock('@react-three/drei', async (importOriginal) => (await import('@app/zombies/drei_fake.test.lib.ts')).withFakeModels(await importOriginal<object>()))

afterEach(() => {
  vi.restoreAllMocks()
})

const ZOMBIES = createRound({ seed: 3, lives: 3, grenades: 0, shoves: 3, ammo: 0, cover: COVER }).zombies

function props(overrides: Partial<HordeSceneProps> = {}): HordeSceneProps {
  return {
    zombies: ZOMBIES,
    answers: ['6', '7', '8', '5'],
    characters: ZOMBIE_CHARACTER_REGISTRY.slice(0, 4),
    projectiles: [],
    blasts: [],
    elapsedMs: 0,
    cover: COVER,
    shadows: false,
    weapon: STARTER_BLASTER,
    weaponPhase: 'readyFirstShot',
    cockingUntilMs: null,
    cockingMs: 700,
    recoilSignal: 0,
    aimNdc: null,
    reducedMotion: false,
    grenadeArmed: false,
    onShot: vi.fn(),
    onGrenade: vi.fn(),
    onReloadStart: vi.fn(),
    ...overrides,
  }
}

function taggedMeshes(scene: THREE.Object3D, zombieId: string): readonly THREE.Object3D[] {
  const meshes: THREE.Object3D[] = []
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const [first] = classifyHordeIntersections([{ object: obj, distance: 1, point: new THREE.Vector3() }])
    if (first?.kind === 'zombie' && first.meta.zombieId === zombieId) meshes.push(obj)
  })
  return meshes
}

function zombie(index: number): HordeZombie {
  const found = ZOMBIES[index]
  if (found === undefined) throw new Error('no such zombie')
  return found
}

describe('HordeScene', () => {
  it('places every zombie at its field position and makes it a hit target', async () => {
    const onZombieReady = vi.fn()
    const renderer = await ReactThreeTestRenderer.create(<HordeScene {...props({ onZombieReady })} />)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(2, 1 / 60)
    })
    const first = zombie(0)
    const group = renderer.scene.instance.getObjectByName(`zombie-${first.id}`)
    expect(group?.position.x).toBeCloseTo(first.x, 3)
    expect(group?.position.z).toBeCloseTo(-first.depth, 3)
    expect(taggedMeshes(renderer.scene.instance, first.id).length).toBeGreaterThan(0)
    expect(onZombieReady).toHaveBeenCalledTimes(4)
  })

  it('follows a zombie as it moves', async () => {
    const renderer = await ReactThreeTestRenderer.create(<HordeScene {...props()} />)
    const moved = ZOMBIES.map((z, i) => (i === 0 ? { ...z, x: z.x + 1, depth: z.depth - 2 } : z))
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<HordeScene {...props({ zombies: moved })} />)
    })
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(60, 1 / 60)
    })
    const group = renderer.scene.instance.getObjectByName(`zombie-${zombie(0).id}`)
    expect(group?.position.x).toBeCloseTo(zombie(0).x + 1, 2)
    expect(group?.position.z).toBeCloseTo(-(zombie(0).depth - 2), 2)
  })

  it('a defeated zombie stops being a target; one that has left is not drawn', async () => {
    const renderer = await ReactThreeTestRenderer.create(<HordeScene {...props()} />)
    const changed = ZOMBIES.map((z, i) => (i === 0 ? { ...z, posture: 'dead' as const } : i === 1 ? { ...z, posture: 'gone' as const } : z))
    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(<HordeScene {...props({ zombies: changed })} />)
    })
    expect(taggedMeshes(renderer.scene.instance, zombie(0).id)).toHaveLength(0)
    expect(renderer.scene.instance.getObjectByName(`zombie-${zombie(1).id}`)).toBeUndefined()
    expect(taggedMeshes(renderer.scene.instance, zombie(2).id).length).toBeGreaterThan(0)
  })

  it('draws a collider for every piece of cover, and thrown objects and blasts', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <HordeScene {...props({ projectiles: [{ id: 'p1', fromX: 0, fromDepth: 8, launchedAtMs: 0, landsAtMs: 1000 }], blasts: [{ id: 'b1', x: 0, depth: 6, atMs: 0, dud: false }], elapsedMs: 300 })} />,
    )
    for (const piece of COVER) expect(renderer.scene.instance.getObjectByName(`collider-${piece.id}`)).toBeTruthy()
    expect(renderer.scene.instance.getObjectByName('floor')).toBeTruthy()
  })
})

describe('HordeScene shots', () => {
  async function clickable(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): Promise<Parameters<typeof renderer.fireEvent>[0]> {
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(2, 1 / 60)
    })
    const target = renderer.scene.findAll((node) => node.props.onPointerDown !== undefined)[0]
    if (target === undefined) throw new Error('expected the clickable field')
    return target
  }

  it('reports a click on a zombie as a hit with its zone', async () => {
    const onShot = vi.fn()
    const renderer = await ReactThreeTestRenderer.create(<HordeScene {...props({ onShot })} />)
    const target = await clickable(renderer)
    const [mesh] = taggedMeshes(renderer.scene.instance, zombie(1).id)
    if (mesh === undefined) throw new Error('expected a tagged mesh')
    await renderer.fireEvent(target, 'onPointerDown', { stopPropagation: () => undefined, intersections: [{ object: mesh, distance: 5, point: new THREE.Vector3(zombie(1).x, 100, -zombie(1).depth) }] })
    expect(onShot).toHaveBeenCalledWith({ zombieId: zombie(1).id, zone: 'head' }, null)
  })

  it('a click on cover is a blocked shot: a miss, naming the cover', async () => {
    const onShot = vi.fn()
    const renderer = await ReactThreeTestRenderer.create(<HordeScene {...props({ onShot })} />)
    const target = await clickable(renderer)
    const collider = renderer.scene.instance.getObjectByName(`collider-${COVER[0]?.id ?? ''}`)
    const [mesh] = taggedMeshes(renderer.scene.instance, zombie(1).id)
    if (collider === undefined || mesh === undefined) throw new Error('expected a collider and a zombie')
    await renderer.fireEvent(target, 'onPointerDown', {
      stopPropagation: () => undefined,
      intersections: [
        { object: collider, distance: 3, point: new THREE.Vector3() },
        { object: mesh, distance: 5, point: new THREE.Vector3() },
      ],
    })
    expect(onShot).toHaveBeenCalledWith(null, COVER[0]?.id)
  })

  it('with a grenade armed, a click lands it where the ray meets the floor', async () => {
    const onGrenade = vi.fn<(at: { readonly x: number; readonly depth: number }) => void>()
    const onShot = vi.fn()
    const renderer = await ReactThreeTestRenderer.create(<HordeScene {...props({ grenadeArmed: true, onGrenade, onShot })} />)
    const target = await clickable(renderer)
    const ray = new THREE.Ray(new THREE.Vector3(1, 2, 0), new THREE.Vector3(0, -1, -1).normalize())
    await renderer.fireEvent(target, 'onPointerDown', { stopPropagation: () => undefined, intersections: [], ray })
    expect(onShot).not.toHaveBeenCalled()
    expect(onGrenade).toHaveBeenCalledTimes(1)
    const at = onGrenade.mock.calls[0]?.[0]
    expect(at?.x).toBeCloseTo(1, 5)
    expect(at?.depth).toBeCloseTo(2, 5)
  })
})
