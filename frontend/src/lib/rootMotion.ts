import * as THREE from 'three'

/**
 * Some of the scientist-zombie GLB's clips bake substantial root-bone
 * translation into the animation itself (an asset-authoring artifact, not
 * intentional root motion this game wants to consume). `Hit_Reaction` in
 * particular carries a large lateral swing on its hip bone — left unfixed,
 * the character visibly slides sideways out of its lane while reacting, then
 * pops back into place once the clip ends and the pose resets to zero time.
 *
 * Equation Outbreak's zombies are positioned entirely by the outer,
 * engine-controlled group transform (see `laneToPosition` in
 * `EquationOutbreakScene.tsx`, driven by `zombieWaveEngine`'s authoritative
 * `distance`) — clips should only ever pose the skeleton in place, never
 * relocate the character. This neutralizes a clip's root bone so its
 * horizontal (X/Z) translation is pinned to its first-frame value for every
 * keyframe, while leaving vertical translation and every rotation track
 * (i.e. the actual reaction pose) untouched.
 */

const neutralizedClips = new WeakSet<THREE.AnimationClip>()

export function neutralizeHorizontalRootMotion(clip: THREE.AnimationClip, rootBoneName: string): void {
  if (neutralizedClips.has(clip)) return
  neutralizedClips.add(clip)

  const track = clip.tracks.find(
    (t): t is THREE.VectorKeyframeTrack => t.name === `${rootBoneName}.position` && t instanceof THREE.VectorKeyframeTrack,
  )
  if (!track) return

  const values = track.values
  const baseX = values[0]
  const baseZ = values[2]
  for (let i = 0; i < values.length; i += 3) {
    values[i] = baseX
    values[i + 2] = baseZ
  }
}
