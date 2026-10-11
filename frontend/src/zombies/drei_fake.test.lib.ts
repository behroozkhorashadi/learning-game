import * as THREE from 'three'
import { ZOMBIE_CHARACTER_REGISTRY } from './character_definitions.pure.lib.ts'
import { fakeZombieGltf } from './zombie_gltf_fixture.test.lib.ts'

/**
 * drei, for the 3D component tests (R3F's test renderer, no WebGL): its
 * loader can't fetch models in jsdom, and `Html` portals into a real DOM
 * canvas. Use from a test file as
 *
 *   vi.mock('@react-three/drei', async (actual) => (await import('@app/zombies/drei_fake.test.lib.ts')).withFakeModels(await actual()))
 *
 * Models are cached per URL like the real loader: a synthetic rig for each
 * character's model, a small box for anything else (the blaster and arms).
 * A URL listed in `FAILING_MODEL_URLS` throws, as a failed load would.
 */

export const FAILING_MODEL_URLS = new Set<string>()

const models = new Map<string, { readonly scene: THREE.Group; readonly animations: THREE.AnimationClip[] }>()

function modelFor(url: string): { readonly scene: THREE.Group; readonly animations: THREE.AnimationClip[] } {
  if (FAILING_MODEL_URLS.has(url)) throw new Error(`could not load ${url}`)
  const cached = models.get(url)
  if (cached !== undefined) return cached
  const character = ZOMBIE_CHARACTER_REGISTRY.find((c) => c.modelUrl === url)
  const model = character === undefined ? { scene: new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1))), animations: [] } : fakeZombieGltf(character)
  models.set(url, model)
  return model
}

export function withFakeModels<T extends object>(actual: T): T & { readonly useGLTF: ((url: string) => ReturnType<typeof modelFor>) & { readonly preload: (url: string) => void }; readonly Html: () => null } {
  const preloaded: string[] = []
  return { ...actual, useGLTF: Object.assign(modelFor, { preload: (url: string) => preloaded.push(url) }), Html: () => null }
}
