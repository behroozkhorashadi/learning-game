import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { CharacterDefinition } from '../lib/characterDefinitions'
import { SCIENTIST_ZOMBIE } from '../lib/characterDefinitions'

/**
 * Reusable GLB-based character renderer for Equation Outbreak. Takes a
 * `CharacterDefinition` (see `lib/characterDefinitions.ts`) rather than
 * depending on the scientist-zombie model directly, so a future reskin is a
 * new registry entry, not a change to this component.
 *
 * Four on-screen instances share one cached GLTF (geometry/material/texture,
 * loaded once via drei's `useGLTF` cache keyed by URL) and each get their
 * own independent skeleton/animation state via `SkeletonUtils.clone` — the
 * standard three.js pattern for "one shared mesh, many independently-posed
 * instances." Cloning only duplicates the node/bone graph, not the geometry
 * or material, so this does not cause extra GPU uploads.
 *
 * This component owns only *rendering* (which clip plays, cross-fades, bone
 * lookup for hitbox anchoring) — it has no gameplay authority. The wave
 * engine decides *when* a zombie is hit or defeated; this component just
 * reflects that decision as an animation name.
 */

/** Clip roles that must play once and hold their last frame, rather than
 * loop — everything else (idle, approach) loops. */
type OneShotRole = 'hitReact' | 'deadHeadshot' | 'deadBody' | 'reach'
const ONE_SHOT_ROLES: OneShotRole[] = ['hitReact', 'deadHeadshot', 'deadBody', 'reach']

const CROSSFADE_SECONDS = 0.15

useGLTF.preload(SCIENTIST_ZOMBIE.modelUrl)

export interface ZombieBones {
  head: THREE.Object3D | null
  torso: THREE.Object3D | null
}

export type ZombieClipRole = keyof CharacterDefinition['clips']

interface Props {
  character: CharacterDefinition
  clipRole: ZombieClipRole
  /** Playback rate — used to speed up `approach` as the wave accelerates. */
  speed?: number
  /** Seconds to offset this instance's start time within a looping clip, so
   * four zombies playing the same clip don't move in lockstep. */
  phaseOffsetSeconds?: number
  /** Fires once when a one-shot clip (hit react, death, reach) completes. */
  onClipFinished?: () => void
  /** Reports this instance's head/torso bone objects once resolved, so the
   * parent can anchor invisible hitboxes to them. */
  onBonesReady?: (bones: ZombieBones) => void
}

export function ZombieCharacter3D({ character, clipRole, speed = 1, phaseOffsetSeconds = 0, onClipFinished, onBonesReady }: Props) {
  const { scene, animations } = useGLTF(character.modelUrl)
  const cloned = useMemo(() => cloneSkeleton(scene) as THREE.Object3D, [scene])
  const group = useRef<THREE.Group>(null!)
  const { actions, mixer } = useAnimations(animations, group)
  const activeClipRef = useRef<string | null>(null)
  const onClipFinishedRef = useRef(onClipFinished)
  onClipFinishedRef.current = onClipFinished

  const clipName = character.clips[clipRole]
  const isOneShot = ONE_SHOT_ROLES.includes(clipRole as OneShotRole)

  // Resolve head/torso bones once per clone, not per render.
  useEffect(() => {
    if (!onBonesReady) return
    let head: THREE.Object3D | null = null
    let torso: THREE.Object3D | null = null
    cloned.traverse((obj) => {
      if (obj.name === character.headBoneName) head = obj
      else if (obj.name === character.torsoBoneName) torso = obj
    })
    onBonesReady({ head, torso })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned])

  useEffect(() => {
    const action = actions[clipName]
    if (!action) return
    const previousName = activeClipRef.current
    const previous = previousName && previousName !== clipName ? actions[previousName] : null

    action.reset()
    action.setLoop(isOneShot ? THREE.LoopOnce : THREE.LoopRepeat, isOneShot ? 1 : Infinity)
    action.clampWhenFinished = isOneShot
    action.timeScale = speed
    if (!isOneShot && phaseOffsetSeconds) {
      action.time = phaseOffsetSeconds
    }
    action.fadeIn(previous ? CROSSFADE_SECONDS : 0)
    action.play()
    previous?.fadeOut(CROSSFADE_SECONDS)
    activeClipRef.current = clipName

    function handleFinished(event: { action: THREE.AnimationAction }) {
      if (event.action === action) onClipFinishedRef.current?.()
    }
    if (isOneShot) {
      mixer.addEventListener('finished', handleFinished)
      return () => mixer.removeEventListener('finished', handleFinished)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, clipName, isOneShot, mixer])

  // Playback speed can change independently of clip (wave acceleration).
  useEffect(() => {
    const action = actions[clipName]
    if (action) action.timeScale = speed
  }, [actions, clipName, speed])

  return (
    <group ref={group} scale={character.scale} position-y={character.yOffset} rotation-y={character.rotationYRadians}>
      <primitive object={cloned} />
    </group>
  )
}
