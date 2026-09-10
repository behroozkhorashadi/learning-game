import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { CharacterDefinition } from '../lib/characterDefinitions'
import { ZOMBIE_CHARACTER_REGISTRY } from '../lib/characterDefinitions'
import { neutralizeHorizontalRootMotion } from '../lib/rootMotion'
import { resolveZombieClip } from '../lib/zombieAnimationFallback'

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
// A missing/stationary-pose fallback for a one-shot role still needs to
// eventually "finish" so gameplay flow (e.g. clearing the hit-reaction
// flag) doesn't wait forever on a mixer 'finished' event that will never
// fire because nothing was ever played. Roughly matches a short reaction
// beat rather than the real clips' actual (longer) durations.
const STATIONARY_FALLBACK_MS = 350

// Every enabled registry entry is preloaded once, at module load — not
// just whichever character happens to be rendered first — so a session
// roster of any four (of what will eventually be 20+) enabled characters
// never pays a load stall mid-game the first time a given one appears.
for (const character of ZOMBIE_CHARACTER_REGISTRY) {
  if (character.enabled) useGLTF.preload(character.modelUrl)
}

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

  // `animations` is the one cached clip array shared by every instance of
  // this model (see useGLTF's URL-keyed cache) — neutralizing here runs once
  // per clip (guarded internally) and fixes it for all instances at once.
  useMemo(() => {
    const hitReactClip = animations.find((clip) => clip.name === character.clips.hitReact)
    if (hitReactClip) neutralizeHorizontalRootMotion(hitReactClip, character.rootBoneName)
  }, [animations, character])
  const group = useRef<THREE.Group>(null!)
  const { actions, mixer } = useAnimations(animations, group)
  const activeClipRef = useRef<string | null>(null)
  const onClipFinishedRef = useRef(onClipFinished)
  onClipFinishedRef.current = onClipFinished

  const configuredClipName = character.clips[clipRole]
  const isOneShot = ONE_SHOT_ROLES.includes(clipRole as OneShotRole)
  // Stable across renders (same `animations` array reference from the GLTF
  // cache) so it's safe as an effect dependency without re-triggering the
  // clip-switch effect every render.
  const availableClipNames = useMemo(() => animations.map((clip) => clip.name), [animations])

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
    const { clipName, usedFallback } = resolveZombieClip(configuredClipName, clipRole, availableClipNames)
    if (usedFallback) {
      console.warn(
        `[ZombieCharacter3D] "${character.displayName}" (${character.id}) is missing animation "${configuredClipName}" for role "${clipRole}"` +
          (clipName ? ` — falling back to "${clipName}".` : ' — no usable animation found, holding a stationary pose.'),
      )
    }

    if (!clipName) {
      // Stationary-pose fallback: nothing to play. One-shot roles still
      // need to "finish" on their own schedule so gameplay flow (e.g. the
      // hit-reaction flag) doesn't wait forever on a mixer event that will
      // never fire because no action was ever started.
      activeClipRef.current = null
      if (isOneShot) {
        const timer = setTimeout(() => onClipFinishedRef.current?.(), STATIONARY_FALLBACK_MS)
        return () => clearTimeout(timer)
      }
      return undefined
    }

    const action = actions[clipName]
    if (!action) return undefined

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
  }, [actions, configuredClipName, clipRole, availableClipNames, isOneShot, mixer])

  // Playback speed can change independently of clip (wave acceleration).
  useEffect(() => {
    const action = activeClipRef.current ? actions[activeClipRef.current] : undefined
    if (action) action.timeScale = speed
  }, [actions, speed])

  return (
    <group ref={group} scale={character.scale} position-y={character.yOffset} rotation-y={character.rotationYRadians}>
      <primitive object={cloned} />
    </group>
  )
}
