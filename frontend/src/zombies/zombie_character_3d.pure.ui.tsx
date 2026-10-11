import { useGLTF } from '@react-three/drei'
import { useMemo, type ReactElement } from 'react'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { CharacterDefinition } from './character_definitions.pure.lib.ts'
import type { ZombieClipRole } from './zombie_animation_fallback.pure.lib.ts'
import { useZombieRig, type ZombieBones } from './use_zombie_rig.pure.hook.ts'

/**
 * A GLB zombie, rendered from a `CharacterDefinition` (character_definitions)
 * rather than any one model, so a reskin is a new registry entry, not a code
 * change.
 *
 * Four on-screen instances share one cached GLTF (geometry, materials,
 * textures, loaded once by useGLTF's URL-keyed cache) and each get their own
 * skeleton and animation state via `SkeletonUtils.clone`: the standard
 * three.js "one mesh, many independently posed instances" pattern. Cloning
 * duplicates only the node/bone graph, so it costs no extra GPU uploads.
 */

export interface ZombieCharacter3DProps {
  readonly character: CharacterDefinition
  readonly clipRole: ZombieClipRole
  readonly speed?: number
  readonly phaseOffsetSeconds?: number
  /** Reports this instance's head and torso bones; the scene splits head shots from body shots at the head bone. */
  readonly onBonesReady?: (bones: ZombieBones) => void
}

/** Starts loading every enabled character's model. Called once from assembly, so no roster ever stalls the first time a character appears. */
export function preloadZombieModels(registry: readonly CharacterDefinition[]): void {
  for (const character of registry) {
    if (character.enabled) useGLTF.preload(character.modelUrl)
  }
}

export function ZombieCharacter3D({ character, clipRole, speed = 1, phaseOffsetSeconds = 0, onBonesReady }: ZombieCharacter3DProps): ReactElement {
  const { scene, animations } = useGLTF(character.modelUrl)
  const cloned = useMemo(() => cloneSkeleton(scene), [scene])
  useZombieRig({ cloned, animations, character, clipRole, speed, phaseOffsetSeconds, onBonesReady })
  return (
    <group scale={character.scale} position-y={character.yOffset} rotation-y={character.rotationYRadians}>
      <primitive object={cloned} />
    </group>
  )
}
