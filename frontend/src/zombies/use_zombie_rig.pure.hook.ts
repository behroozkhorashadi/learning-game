import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import type { CharacterDefinition } from './character_definitions.pure.lib.ts'
import { neutralizeHorizontalRootMotion } from './root_motion.pure.lib.ts'
import { isOneShotRole, isReversedRole, resolveZombieClip, type ZombieClipRole } from './zombie_animation_fallback.pure.lib.ts'

const CROSSFADE_SECONDS = 0.15

export interface ZombieBones {
  readonly head: THREE.Object3D | null
  readonly torso: THREE.Object3D | null
}

export interface ZombieRigOptions {
  /** This instance's own skeleton clone of the shared model. */
  readonly cloned: THREE.Object3D
  /** The model's clips, shared by every instance (useGLTF's URL-keyed cache). */
  readonly animations: readonly THREE.AnimationClip[]
  readonly character: CharacterDefinition
  readonly clipRole: ZombieClipRole
  /** Playback rate; speeds up `approach` as the wave accelerates. */
  readonly speed: number
  /** Seconds into a looping clip to start, so four zombies don't move in lockstep. */
  readonly phaseOffsetSeconds: number
  /** Told this instance's head and torso bones once per clone. */
  readonly onBonesReady: ((bones: ZombieBones) => void) | undefined
}

/**
 * Animates one zombie: which clip plays for its role (cross-fading from the
 * last), looping or holding its last frame, at what speed, plus the head and
 * torso bone lookup. Rendering only: the wave engine decides when a zombie is
 * hit or defeated, and this shows it.
 *
 * Owns an AnimationMixer per clone (what drei's useAnimations does), kept in a
 * ref and stepped every frame.
 */
export function useZombieRig({ cloned, animations, character, clipRole, speed, phaseOffsetSeconds, onBonesReady }: ZombieRigOptions): void {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const activeClipRef = useRef<THREE.AnimationClip | null>(null)
  // Read when a clip starts, not reasons to restart one: speed has its own effect below, and the offset only matters at the start.
  const latest = useRef({ speed, phaseOffsetSeconds, onBonesReady })
  useLayoutEffect(() => {
    latest.current = { speed, phaseOffsetSeconds, onBonesReady }
  })

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(cloned)
    mixerRef.current = mixer
    activeClipRef.current = null
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(cloned)
      mixerRef.current = null
    }
  }, [cloned])

  useFrame((_, delta) => {
    mixerRef.current?.update(delta)
  })

  // Some clips bake sideways root motion into the hip bone; pin it so a zombie never slides out of its lane. Runs once per shared clip.
  useLayoutEffect(() => {
    const hitReact = animations.find((clip) => clip.name === character.clips.hitReact)
    if (hitReact) neutralizeHorizontalRootMotion(hitReact, character.rootBoneName)
  }, [animations, character.clips.hitReact, character.rootBoneName])

  useEffect(() => {
    let head: THREE.Object3D | null = null
    let torso: THREE.Object3D | null = null
    cloned.traverse((obj) => {
      if (obj.name === character.headBoneName) head = obj
      else if (obj.name === character.torsoBoneName) torso = obj
    })
    latest.current.onBonesReady?.({ head, torso })
  }, [cloned, character.headBoneName, character.torsoBoneName])

  const configuredClipName = character.clips[clipRole]

  useEffect(() => {
    const mixer = mixerRef.current
    if (mixer === null) return
    const { clipName, usedFallback } = resolveZombieClip(
      configuredClipName,
      clipRole,
      animations.map((clip) => clip.name),
    )
    if (usedFallback) {
      console.warn(
        `[ZombieCharacter3D] "${character.displayName}" (${character.id}) is missing animation "${configuredClipName}" for role "${clipRole}"` +
          (clipName === null ? ' — no usable animation found, holding a stationary pose.' : ` — falling back to "${clipName}".`),
      )
    }
    const clip = clipName === null ? undefined : animations.find((c) => c.name === clipName)
    if (clip === undefined) {
      activeClipRef.current = null
      return
    }

    const oneShot = isOneShotRole(clipRole)
    const previousClip = activeClipRef.current
    const previous = previousClip !== null && previousClip !== clip ? mixer.existingAction(previousClip) : null
    const action = mixer.clipAction(clip)
    action.reset()
    action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity)
    action.clampWhenFinished = oneShot
    const reversed = isReversedRole(clipRole)
    action.timeScale = reversed ? -latest.current.speed : latest.current.speed
    // A reversed clip starts from its last frame and plays back to its first.
    if (reversed) action.time = clip.duration
    else if (!oneShot && latest.current.phaseOffsetSeconds !== 0) action.time = latest.current.phaseOffsetSeconds
    action.fadeIn(previous ? CROSSFADE_SECONDS : 0)
    action.play()
    previous?.fadeOut(CROSSFADE_SECONDS)
    activeClipRef.current = clip
  }, [cloned, animations, configuredClipName, clipRole, character.displayName, character.id])

  // Playback speed changes on its own (wave acceleration), without restarting the clip.
  useEffect(() => {
    const clip = activeClipRef.current
    const action = clip === null ? null : mixerRef.current?.existingAction(clip)
    if (action) action.timeScale = isReversedRole(clipRole) ? -speed : speed
  }, [speed, clipRole])
}
