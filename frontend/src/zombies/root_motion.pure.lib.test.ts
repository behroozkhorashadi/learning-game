import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { neutralizeHorizontalRootMotion } from './root_motion.pure.lib.ts'

/** `list[i]`, failing the test if it's missing. */
function at<T>(list: readonly T[], i: number): T {
  const item = list[i]
  if (item === undefined) throw new Error(`no item at ${String(i)}`)
  return item
}


function makeClip(): THREE.AnimationClip {
  // A tiny two-track clip mimicking the real asset: a root ("Hips") bone
  // with substantial lateral (X) drift plus some Z and Y motion, and a
  // second bone's rotation track that must survive untouched (the "useful
  // skeletal pose").
  const positionTrack = new THREE.VectorKeyframeTrack(
    'Hips.position',
    [0, 0.5, 1],
    // x, y, z per keyframe
    [-6, 80, 2.5, 40, 82, -1, 88, 80.5, 3.6],
  )
  const rotationTrack = new THREE.QuaternionKeyframeTrack(
    'Spine.quaternion',
    [0, 0.5, 1],
    [0, 0, 0, 1, 0.1, 0, 0, 0.99, 0, 0, 0, 1],
  )
  return new THREE.AnimationClip('Hit_Reaction', 1, [positionTrack, rotationTrack])
}

/** The clip's track named `name`, failing the test if it isn't there. */
function trackNamed(clip: THREE.AnimationClip, name: string): THREE.KeyframeTrack {
  const found = clip.tracks.find((t) => t.name === name)
  if (found === undefined) throw new Error(`no track ${name}`)
  return found
}

describe('neutralizeHorizontalRootMotion', () => {
  it('pins the root bone’s X and Z translation to its first-frame value across all keyframes', () => {
    const clip = makeClip()
    neutralizeHorizontalRootMotion(clip, 'Hips')

    const track = trackNamed(clip, 'Hips.position')
    const values = track.values
    for (let i = 0; i < values.length; i += 3) {
      expect(values[i]).toBeCloseTo(at(Array.from(values), 0)) // X pinned
      expect(values[i + 2]).toBeCloseTo(at(Array.from(values), 2)) // Z pinned
    }
  })

  it('leaves the root bone’s vertical (Y) translation untouched', () => {
    const clip = makeClip()
    const originalY = [80, 82, 80.5]
    neutralizeHorizontalRootMotion(clip, 'Hips')

    const track = trackNamed(clip, 'Hips.position')
    for (let i = 0; i < originalY.length; i++) {
      expect(track.values[i * 3 + 1]).toBeCloseTo(at(originalY, i))
    }
  })

  it('leaves every other track (the reaction pose) untouched', () => {
    const clip = makeClip()
    const before = trackNamed(clip, 'Spine.quaternion').values.slice()
    neutralizeHorizontalRootMotion(clip, 'Hips')
    const after = trackNamed(clip, 'Spine.quaternion').values
    expect(Array.from(after)).toEqual(Array.from(before))
  })

  it('is a no-op when the named root bone has no position track', () => {
    const clip = makeClip()
    expect(() => neutralizeHorizontalRootMotion(clip, 'NoSuchBone')).not.toThrow()
  })

  it('is idempotent — applying it twice does not double-neutralize or throw', () => {
    const clip = makeClip()
    neutralizeHorizontalRootMotion(clip, 'Hips')
    const once = trackNamed(clip, 'Hips.position').values.slice()
    neutralizeHorizontalRootMotion(clip, 'Hips')
    const twice = trackNamed(clip, 'Hips.position').values
    expect(Array.from(twice)).toEqual(Array.from(once))
  })
})
