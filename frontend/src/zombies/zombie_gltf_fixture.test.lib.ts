import * as THREE from 'three'
import type { CharacterDefinition } from './character_definitions.pure.lib.ts'

/**
 * A stand-in for a character's GLB (what drei's useGLTF returns), built in
 * code: a skinned mesh over a root → torso → head bone chain with the
 * character's bone names, and one short clip per role it maps. Small, but
 * real enough for skeleton cloning, the animation mixer, head/body hit zones,
 * and raycasting to all run.
 */
export function fakeZombieGltf(character: CharacterDefinition, options: { readonly missingClips?: readonly string[] } = {}): { readonly scene: THREE.Group; readonly animations: THREE.AnimationClip[] } {
  const root = new THREE.Bone()
  root.name = character.rootBoneName
  const torso = new THREE.Bone()
  torso.name = character.torsoBoneName
  torso.position.y = 1
  const head = new THREE.Bone()
  head.name = character.headBoneName
  head.position.y = 0.6
  root.add(torso)
  torso.add(head)

  // A 0.5 x 2 x 0.5 body from the feet up, every vertex bound to the root bone.
  const geometry = new THREE.BoxGeometry(0.5, 2, 0.5).translate(0, 1, 0)
  const count = geometry.getAttribute('position').count
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(count * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4))
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial())
  mesh.name = 'body'
  mesh.add(root)
  mesh.bind(new THREE.Skeleton([root, torso, head]))

  const scene = new THREE.Group()
  scene.add(mesh)

  const missing = new Set(options.missingClips ?? [])
  const roles = ['idle', 'approach', 'hitReact', 'deadHeadshot', 'deadBody', 'reach'] as const
  const names = [...new Set(roles.map((role) => character.clips[role]))].filter((name) => !missing.has(name))
  const animations = names.map(
    (name) =>
      new THREE.AnimationClip(name, 1, [
        new THREE.VectorKeyframeTrack(`${character.rootBoneName}.position`, [0, 1], [0, 0, 0, 0.3, 0, 0.2]),
        new THREE.QuaternionKeyframeTrack(`${character.headBoneName}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0.1, 0, 0.995]),
      ]),
  )
  return { scene, animations }
}
