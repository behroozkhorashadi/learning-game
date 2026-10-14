import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FAILING_MODEL_URLS } from '@app/zombies/drei_fake.test.lib.ts'
import { EmblemBadge } from './emblem_badge.pure.ui.tsx'

vi.mock('@react-three/drei', async (importOriginal) => (await import('@app/zombies/drei_fake.test.lib.ts')).withFakeModels(await importOriginal<object>()))

afterEach(() => {
  FAILING_MODEL_URLS.clear()
  vi.restoreAllMocks()
})

const SPOT = { faces: [{ position: [0.1, 0, 0.2], rotation: [0, 0, 0] }, { position: [0.1, 0, -0.2], rotation: [0, Math.PI, 0] }], radius: 0.1 } as const

interface Part {
  /** A lit ring (with its colour), or an unlit picture. */
  readonly kind: 'ring' | 'picture' | 'other'
  readonly color: string
  readonly z: number
  readonly raycast: (raycaster: THREE.Raycaster, hits: THREE.Intersection[]) => void
}

/** Every mesh: what it is, where it sits, and its raycast. */
function parts(root: THREE.Object3D): Part[] {
  const found: Part[] = []
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const mesh: THREE.Object3D = child
    const ring = child.material instanceof THREE.MeshStandardMaterial ? child.material.color.getHexString() : null
    const picture = child.material instanceof THREE.MeshBasicMaterial && child.material.map !== null
    found.push({
      kind: ring !== null ? 'ring' : picture ? 'picture' : 'other',
      color: ring ?? '',
      z: mesh.getWorldPosition(new THREE.Vector3()).z,
      raycast: (raycaster, hits) => {
        mesh.raycast(raycaster, hits)
      },
    })
  })
  return found
}

describe('EmblemBadge', () => {
  it('shows the picture on a ring of its colour, on every face, and never takes a shot', async () => {
    const renderer = await ReactThreeTestRenderer.create(<EmblemBadge imageUrl="/art/a1.jpg" ringColor="#FFAA00" spot={SPOT} />)
    const all = parts(renderer.scene.instance)
    const rings = all.filter((part) => part.kind === 'ring')
    expect(rings.map((ring) => ring.color)).toEqual(['ffaa00', 'ffaa00'])
    expect(all.filter((part) => part.kind === 'picture')).toHaveLength(2)
    expect(rings.map((ring) => ring.z)).toEqual([0.2, -0.2])
    const hits: THREE.Intersection[] = []
    for (const part of all) part.raycast(new THREE.Raycaster(new THREE.Vector3(0.1, 0, 5), new THREE.Vector3(0, 0, -1)), hits)
    expect(hits).toEqual([])
  })

  it('keeps the plain coloured disc when the picture fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    FAILING_MODEL_URLS.add('/art/gone.jpg')
    const renderer = await ReactThreeTestRenderer.create(<EmblemBadge imageUrl="/art/gone.jpg" ringColor="#123456" spot={SPOT} />)
    expect(parts(renderer.scene.instance).map((part) => part.kind)).toEqual(['ring', 'ring'])
  })
})
