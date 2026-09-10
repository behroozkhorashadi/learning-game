import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { WeaponPhase } from '../lib/zombieWaveEngine'
import type { WeaponDefinition } from '../lib/weaponDefinitions'
import { playCockingBackSound, playCockingForwardSound, playShotSound } from '../lib/gameAudio'
import {
  AIM_FOLLOW_SMOOTHING,
  EQUATION_BLASTER_URL,
  IDLE_SWAY_AMPLITUDE,
  LEFT_ARM_URL,
  RECOIL_KICK_DISTANCE,
  RECOIL_KICK_PITCH_RADIANS,
  RIGHT_ARM_URL,
  COCKING_WEAPON_DIP_RADIANS,
  DEFAULT_WEAPON_VIEW,
  type Vec3Tuple,
  type WeaponViewConfig,
} from '../lib/equationBlasterConfig'

/**
 * The complete first-person Equation Blaster assembly — the weapon model,
 * a right (trigger) arm, and a left (support/cocking) arm — attached to
 * the camera as a foreground object, replacing the old procedural
 * placeholder gun. See `lib/equationBlasterConfig.ts` for the full
 * asset-audit findings (bounding boxes, orientation, and why the purple
 * ribbed pump is animated as part of the whole weapon rather than as its
 * own node) and the single `WeaponViewConfig` shape every tunable
 * transform lives in.
 *
 * Transform hierarchy (camera-space, outermost to innermost) — every group
 * has one job, so cocking can move the left hand without ever touching the
 * right hand's or the recoil group's own transform:
 *
 *   weapon root (view.weaponPosition, camera-local)
 *     └─ aim/idle group (mouse-follow yaw/pitch + subtle sway)
 *          └─ recoil group (kicks back+up on every accepted shot)
 *               ├─ weapon model group (the blaster GLB, or its fallback)
 *               │    └─ muzzle anchor (flash mesh, at the model's real tip)
 *               ├─ right-arm anchor (fixed — never moves independently)
 *               └─ cocking group (left arm — slides back/forward only
 *                    while cocking; otherwise sits at its resting anchor)
 *
 * None of this participates in zombie/environment raycasting: nothing
 * here has a `userData.raycastKind`, and every mesh sets
 * `raycast={() => null}` explicitly (belt-and-suspenders, matching the
 * pattern already used for decorative Science Fair props).
 */

interface Props {
  weapon: WeaponDefinition
  weaponPhase: WeaponPhase
  /** Absolute `wave.elapsedMs` this cocking window ends at — `null` unless
   * `weaponPhase === 'cocking'`. Combined with `elapsedMs`/`cockingMs`,
   * this is enough to compute cocking animation progress without this
   * component tracking any wall-clock time of its own — it reads the same
   * clock `zombieWaveEngine`'s `tick` already advances. */
  cockingUntilMs: number | null
  elapsedMs: number
  cockingMs: number
  /** Increments once per accepted shot (hit or miss) — the same signal
   * that already drove the placeholder gun's recoil. */
  recoilSignal: number
  aimNdc: { x: number; y: number } | null
  reducedMotion: boolean
  /** Live override for every pose transform, from the dev-only
   * `WeaponTuningPanel` (see `?tuneWeapon=1` in `ZombieMathBlaster.tsx`) —
   * `undefined` in normal play, in which case `DEFAULT_WEAPON_VIEW` is used
   * exactly as before. This exists because guessing these values from
   * screenshots kept missing; the panel lets a human who can actually see
   * the live render drag them into place directly. */
  weaponView?: WeaponViewConfig
  /** Dev-only — hides an arm while calibrating the weapon body itself
   * (step 1 of a recalibration pass), so its geometry doesn't distract
   * from judging the gun's own pose. Always `false`/absent in normal play. */
  hideRightArm?: boolean
  hideLeftArm?: boolean
}

// ---------------------------------------------------------------------
// Loading + fallback
// ---------------------------------------------------------------------

useGLTF.preload(EQUATION_BLASTER_URL)
useGLTF.preload(RIGHT_ARM_URL)
useGLTF.preload(LEFT_ARM_URL)

/** Catches a failed GLTF load (a rejected suspense promise surfaces as a
 * thrown error) for exactly the subtree it wraps, so one missing/broken
 * asset never takes down the rest of the assembly. */
class ModelErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode; warning: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    console.warn(this.props.warning)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** `<primitive>` inserts the cloned scene as-is, so per-mesh JSX props like
 * `raycast={() => null}` can't reach its children directly — disabling
 * raycasting on every mesh inside the clone (mutating only the clone, never
 * the shared cached original) is what actually keeps the weapon/arms out
 * of zombie and environment-collider raycasting. */
export function disableRaycastRecursively(object: THREE.Object3D): void {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) child.raycast = () => {}
  })
}

function BlasterGltf() {
  const { scene } = useGLTF(EQUATION_BLASTER_URL)
  const cloned = useMemo(() => {
    const clone = scene.clone(true)
    disableRaycastRecursively(clone)
    return clone
  }, [scene])
  return <primitive object={cloned} />
}

/** The original procedural gun — kept as the development fallback if the
 * real blaster GLB fails to load. Geometry/materials are shared module
 * singletons (not re-created per render) since this is a fixed shape. */
const fallbackBodyGeometry = new THREE.BoxGeometry(0.14, 0.14, 0.5)
const fallbackGripGeometry = new THREE.BoxGeometry(0.09, 0.2, 0.09)
const fallbackBarrelGeometry = new THREE.CylinderGeometry(0.05, 0.06, 0.22, 16)
const fallbackFinGeometry = new THREE.BoxGeometry(0.02, 0.08, 0.3)

function FallbackBlasterModel({ weaponScale }: { weaponScale: number }) {
  return (
    <group scale={1 / weaponScale} rotation={[0, Math.PI / 2, 0]}>
      <mesh geometry={fallbackBodyGeometry} raycast={() => null}>
        <meshStandardMaterial color="#5C85FF" roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh geometry={fallbackGripGeometry} position={[0, -0.14, 0.12]} rotation={[0.3, 0, 0]} raycast={() => null}>
        <meshStandardMaterial color="#2A2E37" roughness={0.6} />
      </mesh>
      <mesh geometry={fallbackBarrelGeometry} position={[0, 0.02, -0.32]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <meshStandardMaterial color="#F7B23B" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh geometry={fallbackFinGeometry} position={[0, 0.09, -0.05]} raycast={() => null}>
        <meshStandardMaterial color="#5BCC2D" roughness={0.4} />
      </mesh>
    </group>
  )
}

function ArmGltf({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const clone = scene.clone(true)
    disableRaycastRecursively(clone)
    return clone
  }, [scene])
  return <primitive object={cloned} />
}

// ---------------------------------------------------------------------
// Pure transform helpers — exported for direct unit testing (see
// EquationBlaster.test.ts): none of these touch React/Three's scene graph,
// so they're safe to exercise without a WebGL context.
// ---------------------------------------------------------------------

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
}

/** The grip anchors are authored in the blaster's own *unscaled*
 * local-space coordinates (see equationBlasterConfig.ts), but the groups
 * that hold them sit alongside the (separately) scaled+rotated weapon-model
 * group, not inside it — so their positions need the weapon's scale applied
 * once, here, rather than relying on a parent transform that isn't
 * actually theirs. */
export function scalePosition(local: readonly [number, number, number], scale: number): [number, number, number] {
  return [local[0] * scale, local[1] * scale, local[2] * scale]
}

/** Same reasoning as scalePosition above, but for rotation: since the grip
 * anchors are siblings of weaponModelGroup rather than children, they don't
 * automatically inherit the weapon's own rotation the way the muzzle anchor
 * does (it's nested *inside* that group). Without this, the grips would stay
 * fixed at their raw local coordinates no matter how the gun itself is
 * angled. Uses a real `THREE.Euler`/`Vector3.applyEuler` (not hand-derived
 * trig) so it's correct for a full 3-axis rotation, not just a yaw — the
 * weapon's presentation angle needs all three axes to show top *and* side
 * to a camera that never itself tilts (see WeaponViewConfig's docstring). */
export function applyWeaponRotation(local: Vec3Tuple, rotation: Vec3Tuple): [number, number, number] {
  const v = new THREE.Vector3(local[0], local[1], local[2])
  v.applyEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'))
  return [v.x, v.y, v.z]
}

/**
 * The real camera-space ray direction for a given aim point (`aimNdc`,
 * -1..1 across the play area) — derived from the camera's own vertical FOV
 * and aspect ratio, the exact same projection geometry the camera uses to
 * put the crosshair where it visually is. This replaces an earlier version
 * that scaled `aimNdc` by hand-picked "how far should the gun swing"
 * constants: that's an approximation tuned by eye, and kept missing.
 * Deriving the ray from the actual camera geometry means "does the barrel
 * point at the crosshair" is true by construction, not by how well the
 * constants happened to be tuned — nothing left to mistune.
 */
export function computeAimRayDirection(aimNdc: { x: number; y: number } | null, verticalFovDegrees: number, aspect: number): [number, number, number] {
  if (!aimNdc) return [0, 0, -1]
  const x = THREE.MathUtils.clamp(aimNdc.x, -1, 1)
  const y = THREE.MathUtils.clamp(aimNdc.y, -1, 1)
  const halfHeight = Math.tan((verticalFovDegrees * Math.PI) / 360)
  const halfWidth = halfHeight * aspect
  const dir = new THREE.Vector3(x * halfWidth, y * halfHeight, -1).normalize()
  return [dir.x, dir.y, dir.z]
}

/**
 * The rotation that carries the weapon's resting muzzle direction (where it
 * points when `aimNdc` is centered) onto a target ray direction — this is
 * the entire aim-follow now. A quaternion built from the two real
 * directions (`setFromUnitVectors`), not independently-tuned yaw/pitch
 * scale factors, so pitch and yaw can never fight each other or drift out
 * of sync the way two separately-lerped Euler angles could.
 */
export function computeAimQuaternion(restingMuzzleDirection: Vec3Tuple, targetDirection: Vec3Tuple): THREE.Quaternion {
  const from = new THREE.Vector3(restingMuzzleDirection[0], restingMuzzleDirection[1], restingMuzzleDirection[2]).normalize()
  const to = new THREE.Vector3(targetDirection[0], targetDirection[1], targetDirection[2]).normalize()
  return new THREE.Quaternion().setFromUnitVectors(from, to)
}

/** Triangular 0→1→0 easing over the cocking window: 0 at the very start and
 * very end (guaranteeing no drift — see EquationBlaster.test.ts), peaking
 * at 1 exactly at the midpoint (hand fully pulled back). */
export function cockingSlideAmount(progress: number): number {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1)
  const half = clamped < 0.5
  const localT = half ? clamped / 0.5 : (clamped - 0.5) / 0.5
  const eased = easeInOutQuad(localT)
  return half ? eased : 1 - eased
}

/** The left hand's cocking-slide offset (world/recoil-space) at a given
 * overall cocking `progress` (0..1) — always exactly `[0,0,0]` at progress
 * 0 and 1, so resting position is bit-for-bit exact, never an
 * accumulated-drift approximation. */
export function computeCockingOffset(progress: number, direction: Vec3Tuple, distance: number): [number, number, number] {
  const amount = cockingSlideAmount(progress)
  return [direction[0] * amount * distance, direction[1] * amount * distance, direction[2] * amount * distance]
}

function useComputedGripPosition(gripLocal: Vec3Tuple, weaponRotation: Vec3Tuple, weaponScale: number): [number, number, number] {
  return useMemo(() => scalePosition(applyWeaponRotation(gripLocal, weaponRotation), weaponScale), [gripLocal, weaponRotation, weaponScale])
}

export function EquationBlaster({
  weapon,
  weaponPhase,
  cockingUntilMs,
  elapsedMs,
  cockingMs,
  recoilSignal,
  aimNdc,
  reducedMotion,
  weaponView,
  hideRightArm = false,
  hideLeftArm = false,
}: Props) {
  const { camera } = useThree()
  const view = weaponView ?? DEFAULT_WEAPON_VIEW

  const rightGripScaledPosition = useComputedGripPosition(view.rightGripPosition, view.weaponRotation, view.weaponScale)
  const leftGripScaledPosition = useComputedGripPosition(view.leftGripPosition, view.weaponRotation, view.weaponScale)

  // Direction (world/recoil-space) from muzzle toward stock, along the
  // barrel's own actual on-screen angle — the cocking slide moves along
  // this instead of a raw camera axis, so the pump's back-and-forth motion
  // still reads as "along the barrel" at whatever angle the weapon is
  // currently tuned to.
  const stockwardDirection = useMemo(() => applyWeaponRotation([1, 0, 0], view.weaponRotation), [view.weaponRotation])

  // Where the muzzle points at rest (aimNdc centered) — the aim-follow
  // rotates the whole assembly so this direction converges onto the real
  // camera ray toward wherever the crosshair currently is (see
  // computeAimQuaternion below).
  const restingMuzzleDirection = useMemo(() => applyWeaponRotation([-1, 0, 0], view.weaponRotation), [view.weaponRotation])

  const aimGroup = useRef<THREE.Group>(null!)
  const recoilGroup = useRef<THREE.Group>(null!)
  const weaponModelGroup = useRef<THREE.Group>(null!)
  const cockingGroup = useRef<THREE.Group>(null!)
  const muzzleFlash = useRef<THREE.Mesh>(null!)

  const recoilSignalRef = useRef(recoilSignal)
  const recoilStartRef = useRef<number | null>(null)

  if (recoilSignalRef.current !== recoilSignal) {
    recoilSignalRef.current = recoilSignal
    recoilStartRef.current = performance.now()
    playShotSound()
  }

  // Cocking sounds: one at the start (hand pulling back), one at the
  // midpoint (hand pushing forward, weapon ready). Keyed on the phase
  // transition itself, not on progress, so each plays exactly once per
  // cocking sequence regardless of frame rate.
  const cockingSoundStateRef = useRef<'idle' | 'back-played' | 'forward-played'>('idle')
  useEffect(() => {
    if (weaponPhase === 'cocking') {
      cockingSoundStateRef.current = 'idle'
    }
  }, [weaponPhase])

  useFrame((state) => {
    if (!aimGroup.current || !recoilGroup.current) return

    // --- aim: rotate the whole assembly so the muzzle's real direction
    // converges onto the actual camera ray toward the crosshair (derived
    // from the camera's own FOV/aspect — see computeAimRayDirection) ---
    const perspectiveCamera = state.camera as THREE.PerspectiveCamera
    const aspect = state.size.height > 0 ? state.size.width / state.size.height : 1
    const aimTargetDirection = computeAimRayDirection(aimNdc, perspectiveCamera.fov ?? 50, aspect)
    const aimTargetQuaternion = computeAimQuaternion(restingMuzzleDirection, aimTargetDirection)
    aimGroup.current.quaternion.slerp(aimTargetQuaternion, AIM_FOLLOW_SMOOTHING)
    const swayAmplitude = reducedMotion ? 0 : IDLE_SWAY_AMPLITUDE
    aimGroup.current.position.y = Math.sin(state.clock.elapsedTime * 1.4) * swayAmplitude

    // --- recoil (weapon + both arms move together, via the shared parent) ---
    let recoil = 0
    if (recoilStartRef.current != null) {
      const elapsed = performance.now() - recoilStartRef.current
      if (elapsed < weapon.recoilDurationMs) {
        const t = elapsed / weapon.recoilDurationMs
        const strength = (reducedMotion ? 0.4 : 1) * weapon.recoilStrength
        recoil = (1 - t) * strength
      } else {
        recoilStartRef.current = null
      }
    }
    recoilGroup.current.position.z = recoil * RECOIL_KICK_DISTANCE
    recoilGroup.current.rotation.x = -recoil * RECOIL_KICK_PITCH_RADIANS
    if (muzzleFlash.current) {
      muzzleFlash.current.visible = recoil > 0.35
    }

    // --- cocking: weapon dip/rotate (pump is fused — see
    // equationBlasterConfig.ts) + left-hand backward/forward slide ---
    let cockingProgress = 0
    if (weaponPhase === 'cocking' && cockingUntilMs != null) {
      const cockingElapsed = cockingMs - (cockingUntilMs - elapsedMs)
      cockingProgress = THREE.MathUtils.clamp(cockingElapsed / cockingMs, 0, 1)
    }

    // The dip is added on top of the weapon's own baseline X rotation, not
    // a replacement of it — that baseline is part of the weapon's actual
    // on-screen presentation angle now (not zero, unlike when this was a
    // pure yaw), so overwriting it would pop the whole gun flat every time
    // cocking starts and snap back when it ends.
    if (weaponModelGroup.current) {
      weaponModelGroup.current.rotation.x = view.weaponRotation[0] + cockingSlideAmount(cockingProgress) * COCKING_WEAPON_DIP_RADIANS
    }
    if (cockingGroup.current) {
      const offset = computeCockingOffset(cockingProgress, stockwardDirection, view.cockingSlideDistance)
      cockingGroup.current.position.x = leftGripScaledPosition[0] + offset[0]
      cockingGroup.current.position.y = leftGripScaledPosition[1] + offset[1]
      cockingGroup.current.position.z = leftGripScaledPosition[2] + offset[2]
    }

    if (weaponPhase === 'cocking' && cockingUntilMs != null) {
      const half = cockingProgress < 0.5
      if (half && cockingSoundStateRef.current === 'idle') {
        cockingSoundStateRef.current = 'back-played'
        playCockingBackSound()
      } else if (!half && cockingSoundStateRef.current === 'back-played') {
        cockingSoundStateRef.current = 'forward-played'
        playCockingForwardSound()
      }
    }
  })

  return (
    <group>
      {/* Parenting to the camera keeps the whole assembly screen-locked,
       * as a foreground object rather than something placed in the world
       * alongside the zombies. */}
      <primitive object={camera}>
        <group position={view.weaponPosition}>
          <group ref={aimGroup}>
            <group ref={recoilGroup}>
              <group ref={weaponModelGroup} scale={view.weaponScale} rotation={view.weaponRotation}>
                <ModelErrorBoundary
                  fallback={<FallbackBlasterModel weaponScale={view.weaponScale} />}
                  warning="[EquationBlaster] Equation Blaster GLB failed to load — using the placeholder gun."
                >
                  <Suspense fallback={null}>
                    <BlasterGltf />
                  </Suspense>
                </ModelErrorBoundary>

                <mesh ref={muzzleFlash} position={view.muzzlePosition} visible={false} raycast={() => null}>
                  <sphereGeometry args={[0.14, 12, 12]} />
                  <meshBasicMaterial color="#FFF7D6" transparent opacity={0.9} depthWrite={false} />
                </mesh>
              </group>

              {/* Right (trigger) arm — fixed to the grip; never moves on
               * its own during cocking, only via the shared recoil parent. */}
              {!hideRightArm && (
                <group position={rightGripScaledPosition}>
                  <group scale={view.rightArmScale} rotation={view.rightArmRotation}>
                    <ModelErrorBoundary fallback={null} warning="[EquationBlaster] Right-arm GLB failed to load — rendering without it.">
                      <Suspense fallback={null}>
                        <ArmGltf url={RIGHT_ARM_URL} />
                      </Suspense>
                    </ModelErrorBoundary>
                  </group>
                </group>
              )}

              {/* Left (support/cocking) arm — its own anchor so cocking can
               * slide it independently while still inheriting aim/idle/recoil. */}
              {!hideLeftArm && (
                <group ref={cockingGroup} position={leftGripScaledPosition}>
                  <group scale={view.leftArmScale} rotation={view.leftArmRotation}>
                    <ModelErrorBoundary fallback={null} warning="[EquationBlaster] Left-arm GLB failed to load — rendering without it.">
                      <Suspense fallback={null}>
                        <ArmGltf url={LEFT_ARM_URL} />
                      </Suspense>
                    </ModelErrorBoundary>
                  </group>
                </group>
              )}
            </group>
          </group>
        </group>
      </primitive>
    </group>
  )
}
