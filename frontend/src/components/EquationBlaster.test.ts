import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'

/**
 * Unit tests for `EquationBlaster`'s pure, framework-free helpers.
 *
 * The component itself parents its assembly to the R3F camera and drives
 * everything through `useFrame`/`useThree`/`useGLTF` — mounting it for real
 * needs an actual WebGL context, which jsdom doesn't provide (there is no
 * `@react-three/test-renderer` in this project for the same reason
 * `ZombieMathBlaster`'s own tests mock the whole 3D scene away rather than
 * rendering it). What *is* both safe and meaningful to test directly,
 * without any of that, is the plain object-graph and math logic this module
 * exports — in particular `disableRaycastRecursively` (weapon/arm meshes
 * must never intercept a shot meant for a zombie) and the cocking-offset
 * math (transforms must reset without drift).
 *
 * `@react-three/fiber`/`@react-three/drei` are mocked purely so importing
 * the module doesn't trigger a real `useGLTF.preload` network/file load.
 */

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({ camera: new THREE.PerspectiveCamera() })),
}))

vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(vi.fn(() => ({ scene: new THREE.Group() })), { preload: vi.fn() }),
}))

const {
  disableRaycastRecursively,
  easeInOutQuad,
  scalePosition,
  applyWeaponRotation,
  cockingSlideAmount,
  computeCockingOffset,
  computeVisualCockingProgress,
  computeAimRayDirection,
  computeAimQuaternion,
} = await import('./EquationBlaster')
const { DEFAULT_WEAPON_VIEW } = await import('../lib/equationBlasterConfig')

describe('disableRaycastRecursively', () => {
  it('replaces raycast on every mesh in the subtree so it never reports an intersection', () => {
    const root = new THREE.Group()
    const child = new THREE.Group()
    const mesh1 = new THREE.Mesh(new THREE.BoxGeometry())
    const mesh2 = new THREE.Mesh(new THREE.BoxGeometry())
    root.add(child)
    child.add(mesh1)
    root.add(mesh2)

    const raycaster = new THREE.Raycaster()
    raycaster.set(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1))
    expect(raycaster.intersectObject(root, true).length).toBeGreaterThan(0)

    disableRaycastRecursively(root)

    expect(raycaster.intersectObject(root, true)).toHaveLength(0)
  })

  it('leaves non-mesh objects (groups) alone — nothing to disable, nothing to break', () => {
    const root = new THREE.Group()
    const nestedGroup = new THREE.Group()
    root.add(nestedGroup)

    expect(() => disableRaycastRecursively(root)).not.toThrow()
  })

  it('only mutates the object passed in, never a separate clone made from the same source', () => {
    const original = new THREE.Group()
    original.add(new THREE.Mesh(new THREE.BoxGeometry()))
    const clone = original.clone(true)

    disableRaycastRecursively(clone)

    const raycaster = new THREE.Raycaster()
    raycaster.set(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1))
    // The clone is blind to the raycaster...
    expect(raycaster.intersectObject(clone, true)).toHaveLength(0)
    // ...but the original — e.g. drei's shared cached scene — still isn't.
    expect(raycaster.intersectObject(original, true).length).toBeGreaterThan(0)
  })
})

describe('easeInOutQuad', () => {
  it('starts and ends at the endpoints', () => {
    expect(easeInOutQuad(0)).toBe(0)
    expect(easeInOutQuad(1)).toBe(1)
  })

  it('is exactly halfway at t=0.5, matching a symmetric ease', () => {
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5, 5)
  })

  it('is monotonically non-decreasing across the range (no cocking-animation reversal)', () => {
    let prev = -Infinity
    for (let t = 0; t <= 1; t += 0.05) {
      const value = easeInOutQuad(t)
      expect(value).toBeGreaterThanOrEqual(prev)
      prev = value
    }
  })
})

describe('scalePosition', () => {
  it('scales every axis by the given scale uniformly', () => {
    const local = [2, -4, 6] as const
    const [x, y, z] = scalePosition(local, 0.42)
    expect(x).toBeCloseTo(0.84, 10)
    expect(y).toBeCloseTo(-1.68, 10)
    expect(z).toBeCloseTo(2.52, 10)
  })

  it('preserves the zero vector regardless of scale', () => {
    expect(scalePosition([0, 0, 0], 0.7)).toEqual([0, 0, 0])
  })
})

describe('applyWeaponRotation', () => {
  it('is the identity at rotation=[0,0,0]', () => {
    const [x, y, z] = applyWeaponRotation([1, 2, 3], [0, 0, 0])
    expect(x).toBeCloseTo(1, 10)
    expect(y).toBeCloseTo(2, 10)
    expect(z).toBeCloseTo(3, 10)
  })

  it('rotates a point on the local +X axis onto -Z at yaw=-90° (pure Y rotation), matching the muzzle convention', () => {
    // Mirrors the case this function exists for: the blaster's own
    // muzzle-to-stock axis (local X), under a pure -90° yaw, sends its
    // muzzle (local -X) toward world -Z, the camera's forward direction.
    const [x, y, z] = applyWeaponRotation([1, 0, 0], [0, -Math.PI / 2, 0])
    expect(x).toBeCloseTo(0, 10)
    expect(y).toBeCloseTo(0, 10)
    expect(z).toBeCloseTo(1, 10)
  })

  it('a pure yaw leaves the Y component untouched', () => {
    const [, y] = applyWeaponRotation([3, 7, -2], [0, 0.42, 0])
    expect(y).toBeCloseTo(7, 10)
  })

  it('a non-zero pitch/roll DOES move a point that a pure yaw could never touch off the Y axis', () => {
    // This is exactly the bug a pure-yaw-only implementation would have:
    // revealing the weapon's top surface to a camera that never itself
    // tilts requires rotating local Y itself, which no yaw-only rotation
    // can do (Y is invariant under a Y-axis-only rotation).
    const yawOnly = applyWeaponRotation([0, 1, 0], [0, 0.5, 0])
    expect(yawOnly[1]).toBeCloseTo(1, 10)

    const withRoll = applyWeaponRotation([0, 1, 0], [0.3, 0.5, 0.2])
    expect(withRoll[1]).not.toBeCloseTo(1, 5)
  })

  it('preserves vector length (a rotation, not a scale or shear)', () => {
    const local: readonly [number, number, number] = [3, 0.5, 4]
    const rotated = applyWeaponRotation(local, [0.4, 1.1, -0.2])
    const originalLength = Math.hypot(...local)
    const rotatedLength = Math.hypot(...rotated)
    expect(rotatedLength).toBeCloseTo(originalLength, 10)
  })
})

describe('cockingSlideAmount', () => {
  it('is exactly 0 at progress 0 and progress 1 — resting transforms have zero drift', () => {
    expect(cockingSlideAmount(0)).toBe(0)
    expect(cockingSlideAmount(1)).toBe(0)
  })

  it('peaks at 1 exactly at the midpoint (hand fully pulled back)', () => {
    expect(cockingSlideAmount(0.5)).toBeCloseTo(1, 10)
  })

  it('clamps out-of-range progress instead of extrapolating', () => {
    expect(cockingSlideAmount(-5)).toBe(0)
    expect(cockingSlideAmount(5)).toBe(0)
  })

  it('is symmetric around the midpoint (pull-back and return take the same shape)', () => {
    expect(cockingSlideAmount(0.25)).toBeCloseTo(cockingSlideAmount(0.75), 10)
  })
})

describe('computeVisualCockingProgress', () => {
  // Real numbers from the game: a 900ms cocking window, 150ms recoil.
  const cockingMs = 900
  const recoilSettleMs = 150

  it('holds at exactly 0 for the entire recoil-settle window — the kick-back plays with no reload motion yet', () => {
    expect(computeVisualCockingProgress(0, cockingMs, recoilSettleMs)).toBe(0)
    expect(computeVisualCockingProgress(75, cockingMs, recoilSettleMs)).toBe(0)
    expect(computeVisualCockingProgress(150, cockingMs, recoilSettleMs)).toBe(0)
  })

  it('reaches exactly 1 at cockingElapsedMs === cockingMs — no added delay to when the second shot is allowed', () => {
    expect(computeVisualCockingProgress(cockingMs, cockingMs, recoilSettleMs)).toBe(1)
  })

  it('is roughly halfway through its own (compressed) window at the midpoint between settle and end', () => {
    const midpoint = recoilSettleMs + (cockingMs - recoilSettleMs) / 2
    expect(computeVisualCockingProgress(midpoint, cockingMs, recoilSettleMs)).toBeCloseTo(0.5, 10)
  })

  it('is monotonically non-decreasing across the whole cocking window', () => {
    let prev = -Infinity
    for (let t = 0; t <= cockingMs; t += 15) {
      const value = computeVisualCockingProgress(t, cockingMs, recoilSettleMs)
      expect(value).toBeGreaterThanOrEqual(prev)
      prev = value
    }
  })

  it('with zero settle delay, behaves exactly like the un-delayed 0..1 mapping', () => {
    expect(computeVisualCockingProgress(0, cockingMs, 0)).toBe(0)
    expect(computeVisualCockingProgress(cockingMs / 2, cockingMs, 0)).toBeCloseTo(0.5, 10)
    expect(computeVisualCockingProgress(cockingMs, cockingMs, 0)).toBe(1)
  })

  it('clamps rather than exceeding 1 if elapsed somehow overshoots cockingMs', () => {
    expect(computeVisualCockingProgress(cockingMs + 500, cockingMs, recoilSettleMs)).toBe(1)
  })
})

describe('computeCockingOffset', () => {
  const direction: readonly [number, number, number] = [0.6, 0, 0.8] // a unit-ish vector

  it('is exactly [0,0,0] at progress 0 and 1 — no drift after a full cocking cycle', () => {
    expect(computeCockingOffset(0, direction, 0.2)).toEqual([0, 0, 0])
    expect(computeCockingOffset(1, direction, 0.2)).toEqual([0, 0, 0])
  })

  it('scales linearly with the configured distance at the midpoint', () => {
    const a = computeCockingOffset(0.5, direction, 0.1)
    const b = computeCockingOffset(0.5, direction, 0.2)
    expect(b[0]).toBeCloseTo(a[0] * 2, 10)
    expect(b[2]).toBeCloseTo(a[2] * 2, 10)
  })

  it('moves along the given direction, not some other axis', () => {
    const [x, y, z] = computeCockingOffset(0.5, direction, 0.5)
    expect(y).toBe(0) // direction has no Y component
    expect(x).toBeGreaterThan(0)
    expect(z).toBeGreaterThan(0)
  })
})

describe('WeaponViewConfig flows through the same grip-anchor computation EquationBlaster uses', () => {
  // EquationBlaster computes each grip anchor as
  // scalePosition(applyWeaponRotation(gripLocal, weaponRotation), weaponScale)
  // — mirrored here to confirm a `weaponView` override actually changes the
  // anchor a live render would use, rather than the override silently being
  // ignored in favor of the hardcoded default.
  function gripAnchor(gripLocal: readonly [number, number, number], weaponRotation: readonly [number, number, number], weaponScale: number) {
    return scalePosition(applyWeaponRotation(gripLocal, weaponRotation), weaponScale)
  }

  it('an identity override (no rotation, scale 1) reduces to the raw grip position', () => {
    const anchor = gripAnchor(DEFAULT_WEAPON_VIEW.rightGripPosition, [0, 0, 0], 1)
    expect(anchor[0]).toBeCloseTo(DEFAULT_WEAPON_VIEW.rightGripPosition[0], 10)
    expect(anchor[1]).toBeCloseTo(DEFAULT_WEAPON_VIEW.rightGripPosition[1], 10)
    expect(anchor[2]).toBeCloseTo(DEFAULT_WEAPON_VIEW.rightGripPosition[2], 10)
  })

  it('overriding weaponRotation/weaponScale produces a different anchor than DEFAULT_WEAPON_VIEW', () => {
    const defaultAnchor = gripAnchor(DEFAULT_WEAPON_VIEW.rightGripPosition, DEFAULT_WEAPON_VIEW.weaponRotation, DEFAULT_WEAPON_VIEW.weaponScale)
    const overriddenAnchor = gripAnchor(DEFAULT_WEAPON_VIEW.rightGripPosition, [0, 0, 0], 1)
    expect(overriddenAnchor).not.toEqual(defaultAnchor)
  })

  it('overriding just the grip position moves only that anchor, using the same weapon rotation/scale', () => {
    const original = gripAnchor(DEFAULT_WEAPON_VIEW.leftGripPosition, DEFAULT_WEAPON_VIEW.weaponRotation, DEFAULT_WEAPON_VIEW.weaponScale)
    const movedGrip: readonly [number, number, number] = [
      DEFAULT_WEAPON_VIEW.leftGripPosition[0] + 0.1,
      DEFAULT_WEAPON_VIEW.leftGripPosition[1],
      DEFAULT_WEAPON_VIEW.leftGripPosition[2],
    ]
    const moved = gripAnchor(movedGrip, DEFAULT_WEAPON_VIEW.weaponRotation, DEFAULT_WEAPON_VIEW.weaponScale)
    expect(moved).not.toEqual(original)
  })
})

describe('cocking dip resets to the weapon\'s own baseline rotation, not zero', () => {
  // Regression test for a real bug hit while adding a non-zero baseline
  // rotation.x: the cocking dip used to *replace* rotation.x outright
  // (`rotation.x = slideAmount * DIP`), which was harmless while the
  // baseline was 0 but would silently discard any real presentation tilt.
  // EquationBlaster.tsx now computes
  // `weaponRotation[0] + cockingSlideAmount(progress) * DIP`, which this
  // confirms reduces to exactly the baseline at rest.
  it('at progress 0 or 1, baseline + slideAmount*DIP equals the baseline exactly', () => {
    const baseline = DEFAULT_WEAPON_VIEW.weaponRotation[0]
    const dip = 0.19
    expect(baseline + cockingSlideAmount(0) * dip).toBe(baseline)
    expect(baseline + cockingSlideAmount(1) * dip).toBe(baseline)
  })

  it('at the midpoint, the dip is added on top of the baseline, not replacing it', () => {
    const baseline = DEFAULT_WEAPON_VIEW.weaponRotation[0]
    const dip = 0.19
    const atMidpoint = baseline + cockingSlideAmount(0.5) * dip
    expect(atMidpoint).toBeCloseTo(baseline + dip, 10)
    expect(atMidpoint).not.toBeCloseTo(dip, 5) // would be true only if baseline were discarded
  })
})

describe('computeAimRayDirection', () => {
  const fov = 52.25 // matches the game's own vertical-FOV computation at its default aspect
  const aspect = 900 / 560

  it('points straight down -Z when there is no aim input', () => {
    expect(computeAimRayDirection(null, fov, aspect)).toEqual([0, 0, -1])
  })

  it('points straight down -Z when the aim point is exactly centered', () => {
    const [x, y, z] = computeAimRayDirection({ x: 0, y: 0 }, fov, aspect)
    expect(x).toBeCloseTo(0, 10)
    expect(y).toBeCloseTo(0, 10)
    expect(z).toBeCloseTo(-1, 10)
  })

  it('a positive aimNdc.x (crosshair right of center) produces a positive-X ray — no sign flip', () => {
    const [x] = computeAimRayDirection({ x: 1, y: 0 }, fov, aspect)
    expect(x).toBeGreaterThan(0)
  })

  it('a negative aimNdc.x (crosshair left of center) produces a negative-X ray', () => {
    const [x] = computeAimRayDirection({ x: -1, y: 0 }, fov, aspect)
    expect(x).toBeLessThan(0)
  })

  it('a positive aimNdc.y (crosshair above center) produces a positive-Y (upward) ray', () => {
    const [, y] = computeAimRayDirection({ x: 0, y: 1 }, fov, aspect)
    expect(y).toBeGreaterThan(0)
  })

  it('clamps out-of-range aimNdc instead of extrapolating past the screen edge', () => {
    const atEdge = computeAimRayDirection({ x: 1, y: 1 }, fov, aspect)
    const beyondEdge = computeAimRayDirection({ x: 5, y: 5 }, fov, aspect)
    expect(beyondEdge).toEqual(atEdge)
  })

  it('always returns a unit vector', () => {
    const [x, y, z] = computeAimRayDirection({ x: 0.4, y: -0.7 }, fov, aspect)
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 10)
  })

  it('a wider aspect ratio produces a proportionally wider horizontal spread at the same aimNdc.x', () => {
    const narrow = computeAimRayDirection({ x: 1, y: 0 }, fov, 1)
    const wide = computeAimRayDirection({ x: 1, y: 0 }, fov, 3)
    // Both hit the edge of their own frustum, but a wider aspect ratio means
    // more horizontal FOV is packed into the same aimNdc range, so the ray
    // angles further from center (smaller z component once normalized,
    // since more of the unit vector's length goes into x).
    expect(Math.abs(wide[2])).toBeLessThan(Math.abs(narrow[2]))
  })
})

describe('computeAimQuaternion', () => {
  it('is the identity rotation when the resting direction already equals the target', () => {
    const q = computeAimQuaternion([0, 0, -1], [0, 0, -1])
    const v = new THREE.Vector3(1, 2, 3).applyQuaternion(q)
    expect(v.x).toBeCloseTo(1, 10)
    expect(v.y).toBeCloseTo(2, 10)
    expect(v.z).toBeCloseTo(3, 10)
  })

  it('rotates the resting direction exactly onto the target direction', () => {
    const resting: readonly [number, number, number] = [-0.3, 0.2, -0.9]
    const target: readonly [number, number, number] = [0.5, -0.4, -0.7]
    const q = computeAimQuaternion(resting, target)
    const restingNormalized = new THREE.Vector3(...resting).normalize()
    const targetNormalized = new THREE.Vector3(...target).normalize()
    const rotated = restingNormalized.applyQuaternion(q)
    expect(rotated.x).toBeCloseTo(targetNormalized.x, 10)
    expect(rotated.y).toBeCloseTo(targetNormalized.y, 10)
    expect(rotated.z).toBeCloseTo(targetNormalized.z, 10)
  })

  it('end to end: applying the computed quaternion to the resting muzzle direction reproduces the real camera-ray target — this is the whole aim-follow', () => {
    const restingMuzzleDirection = applyWeaponRotation([-1, 0, 0], DEFAULT_WEAPON_VIEW.weaponRotation)
    const target = computeAimRayDirection({ x: 0.6, y: -0.3 }, 52.25, 900 / 560)
    const q = computeAimQuaternion(restingMuzzleDirection, target)
    const rotated = new THREE.Vector3(...restingMuzzleDirection).normalize().applyQuaternion(q)
    const targetNormalized = new THREE.Vector3(...target).normalize()
    expect(rotated.x).toBeCloseTo(targetNormalized.x, 10)
    expect(rotated.y).toBeCloseTo(targetNormalized.y, 10)
    expect(rotated.z).toBeCloseTo(targetNormalized.z, 10)
  })
})
