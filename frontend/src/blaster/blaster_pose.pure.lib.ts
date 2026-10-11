import * as THREE from 'three'
import type { Vec3Tuple } from './blaster_config.pure.lib.ts'

/**
 * The first-person blaster's pose maths (equation_blaster.pure.ui.tsx renders
 * it): grip anchors, aim-follow, and the cocking slide. Pure transforms, so
 * they're tested without a scene. The `write*` variants are the per-frame
 * versions: they fill caller-owned objects instead of allocating.
 */

export type Vec3 = [number, number, number]

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/**
 * The grip anchors are authored in the blaster's own unscaled local space, but
 * the groups holding them are siblings of the scaled weapon model, not
 * children, so the weapon's scale is applied here once.
 */
export function scalePosition(local: Vec3Tuple, scale: number): Vec3 {
  return [local[0] * scale, local[1] * scale, local[2] * scale]
}

/**
 * Same for rotation: the grip anchors don't inherit the weapon's rotation (the
 * muzzle anchor, nested inside it, does). A real Euler rotation, not hand trig,
 * so all three axes are right: the presentation angle shows the top and side
 * of the gun to a camera that never tilts.
 */
export function applyWeaponRotation(local: Vec3Tuple, rotation: Vec3Tuple): Vec3 {
  const v = new THREE.Vector3(local[0], local[1], local[2])
  v.applyEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'))
  return [v.x, v.y, v.z]
}

/**
 * Writes the camera-space ray toward `aimNdc` (-1..1 across the play area) into
 * `out`, from the camera's own vertical FOV and aspect: the same projection
 * that puts the crosshair where it is, so "the barrel points at the crosshair"
 * holds by construction rather than by tuned constants.
 */
export function writeAimRayDirection(aimNdc: { readonly x: number; readonly y: number } | null, verticalFovDegrees: number, aspect: number, out: THREE.Vector3): THREE.Vector3 {
  if (aimNdc === null) return out.set(0, 0, -1)
  const halfHeight = Math.tan((verticalFovDegrees * Math.PI) / 360)
  const halfWidth = halfHeight * aspect
  return out.set(THREE.MathUtils.clamp(aimNdc.x, -1, 1) * halfWidth, THREE.MathUtils.clamp(aimNdc.y, -1, 1) * halfHeight, -1).normalize()
}

export function computeAimRayDirection(aimNdc: { readonly x: number; readonly y: number } | null, verticalFovDegrees: number, aspect: number): Vec3 {
  const dir = writeAimRayDirection(aimNdc, verticalFovDegrees, aspect, new THREE.Vector3())
  return [dir.x, dir.y, dir.z]
}

/**
 * The rotation carrying the weapon's resting muzzle direction onto the target
 * ray: the whole aim-follow. Built from two real directions
 * (`setFromUnitVectors`), so pitch and yaw can't drift apart the way two
 * separately-lerped Euler angles could. Both inputs must be unit vectors.
 */
export function writeAimQuaternion(restingMuzzleDirection: THREE.Vector3, targetDirection: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  return out.setFromUnitVectors(restingMuzzleDirection, targetDirection)
}

export function computeAimQuaternion(restingMuzzleDirection: Vec3Tuple, targetDirection: Vec3Tuple): THREE.Quaternion {
  const from = new THREE.Vector3(...restingMuzzleDirection).normalize()
  const to = new THREE.Vector3(...targetDirection).normalize()
  return writeAimQuaternion(from, to, new THREE.Quaternion())
}

/** Triangular 0→1→0 easing over the cocking window: 0 at both ends (no drift), 1 at the midpoint (hand fully back). */
export function cockingSlideAmount(progress: number): number {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1)
  const half = clamped < 0.5
  const eased = easeInOutQuad(half ? clamped / 0.5 : (clamped - 0.5) / 0.5)
  return half ? eased : 1 - eased
}

/**
 * Remaps time into cocking onto a delayed 0..1 visual progress that holds at 0
 * until the shot's recoil has settled, then runs through the rest of the
 * window, so the reload motion starts after the kick instead of on top of it.
 * The gameplay window (`cockingMs`, when the second shot is allowed) is
 * unchanged: progress still reaches exactly 1 at `cockingElapsedMs === cockingMs`.
 */
export function computeVisualCockingProgress(cockingElapsedMs: number, cockingMs: number, recoilSettleMs: number): number {
  const span = Math.max(1, cockingMs - recoilSettleMs)
  const delayed = Math.max(0, cockingElapsedMs - recoilSettleMs)
  return THREE.MathUtils.clamp(delayed / span, 0, 1)
}

/** The left hand's slide offset at cocking `progress`: exactly [0,0,0] at 0 and 1, so the rest pose is exact. */
export function computeCockingOffset(progress: number, direction: Vec3Tuple, distance: number): Vec3 {
  const amount = cockingSlideAmount(progress) * distance
  return [direction[0] * amount, direction[1] * amount, direction[2] * amount]
}

/** Recoil strength at `elapsedMs` into a `durationMs` kick: a quick kick easing back to 0, or 0 once it's over. */
export function recoilAt(elapsedMs: number, durationMs: number, strength: number): number {
  if (elapsedMs < 0 || elapsedMs >= durationMs) return 0
  const t = elapsedMs / durationMs
  return (1 - t) * (1 - t) * strength
}
