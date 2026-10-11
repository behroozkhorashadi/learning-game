import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState, type ReactElement } from 'react'
import * as THREE from 'three'
import { AsyncBoundary } from '@app/boundary/async_boundary.pure.ui.tsx'
import type { WeaponPhase } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import {
  AIM_FOLLOW_SMOOTHING,
  COCKING_WEAPON_DIP_RADIANS,
  DEFAULT_WEAPON_VIEW,
  EQUATION_BLASTER_URL,
  IDLE_SWAY_AMPLITUDE,
  LEFT_ARM_URL,
  RECOIL_KICK_DISTANCE,
  RECOIL_KICK_PITCH_RADIANS,
  RIGHT_ARM_URL,
  type WeaponViewConfig,
} from './blaster_config.pure.lib.ts'
import { applyWeaponRotation, cockingSlideAmount, computeVisualCockingProgress, recoilAt, scalePosition, writeAimQuaternion, writeAimRayDirection } from './blaster_pose.pure.lib.ts'
import { MuzzleFlash } from './muzzle_flash.pure.ui.tsx'
import { disableRaycastRecursively } from './scene_graph.pure.lib.ts'
import type { WeaponDefinition } from './weapon_definitions.pure.lib.ts'

/**
 * The first-person Equation Blaster: the weapon model, a right (trigger) arm,
 * and a left (support/cocking) arm, attached to the camera as a foreground
 * object. blaster_config.pure.lib.ts has the asset audit (bounding boxes,
 * orientation, why the pump moves with the whole weapon) and the
 * `WeaponViewConfig` every tunable transform lives in.
 *
 * Transform hierarchy (camera space, outermost first). Each group has one job,
 * so cocking moves the left hand without touching the right hand or recoil:
 *
 *   weapon root (view.weaponPosition)
 *     └─ aim/idle group (aim-follow rotation + subtle sway)
 *          └─ recoil group (kicks back and up on every accepted shot)
 *               ├─ weapon model group (the blaster GLB, or its fallback)
 *               │    └─ muzzle anchor (MuzzleFlash, at the model's real tip)
 *               ├─ right-arm anchor (fixed)
 *               └─ cocking group (left arm: slides only while cocking)
 *
 * Nothing here takes part in zombie/environment raycasting: no
 * `userData.raycastKind`, and every mesh's raycast is disabled.
 *
 * All motion runs in `useFrame`, timed by summed frame deltas, and allocates
 * nothing per frame. Sounds are the caller's: the shot sound plays where the
 * shot is accepted, and `onReloadStart` fires once per cocking, after recoil.
 */

export interface EquationBlasterProps {
  readonly weapon: WeaponDefinition
  readonly weaponPhase: WeaponPhase
  /** The `wave.elapsedMs` this cocking ends at, or null unless cocking. With `elapsedMs`/`cockingMs`, that's the cocking progress, on the wave engine's own clock. */
  readonly cockingUntilMs: number | null
  readonly elapsedMs: number
  readonly cockingMs: number
  /** Increments once per accepted shot (hit or miss): starts recoil and the muzzle flash. */
  readonly recoilSignal: number
  readonly aimNdc: { readonly x: number; readonly y: number } | null
  readonly reducedMotion: boolean
  /** Fires once per cocking, when the reload motion starts (after the shot's recoil has settled). */
  readonly onReloadStart: () => void
  /** Dev-only live pose override from the weapon tuning panel; DEFAULT_WEAPON_VIEW otherwise. */
  readonly weaponView?: WeaponViewConfig | undefined
  /** Dev-only: hide an arm while calibrating the weapon body. */
  readonly hideRightArm?: boolean
  readonly hideLeftArm?: boolean
}

/** Starts loading the blaster and arm models. Called once from assembly, so the first round never waits on them. */
export function preloadBlasterModels(): void {
  useGLTF.preload(EQUATION_BLASTER_URL)
  useGLTF.preload(RIGHT_ARM_URL)
  useGLTF.preload(LEFT_ARM_URL)
}

function ClonedGltf({ url }: { readonly url: string }): ReactElement {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const clone = scene.clone(true)
    disableRaycastRecursively(clone)
    return clone
  }, [scene])
  return <primitive object={cloned} />
}

/** The original procedural gun, shown if the blaster GLB fails to load. Shared geometry: it's a fixed shape. */
const fallbackBodyGeometry = new THREE.BoxGeometry(0.14, 0.14, 0.5)
const fallbackGripGeometry = new THREE.BoxGeometry(0.09, 0.2, 0.09)
const fallbackBarrelGeometry = new THREE.CylinderGeometry(0.05, 0.06, 0.22, 16)
const fallbackFinGeometry = new THREE.BoxGeometry(0.02, 0.08, 0.3)

function FallbackBlasterModel({ weaponScale }: { readonly weaponScale: number }): ReactElement {
  return (
    <group name="fallback-blaster" scale={1 / weaponScale} rotation={[0, Math.PI / 2, 0]}>
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

export function EquationBlaster({
  weapon,
  weaponPhase,
  cockingUntilMs,
  elapsedMs,
  cockingMs,
  recoilSignal,
  aimNdc,
  reducedMotion,
  onReloadStart,
  weaponView,
  hideRightArm = false,
  hideLeftArm = false,
}: EquationBlasterProps): ReactElement {
  const camera = useThree((state) => state.camera)
  const view = weaponView ?? DEFAULT_WEAPON_VIEW

  const rightGripPosition = useMemo(() => scalePosition(applyWeaponRotation(view.rightGripPosition, view.weaponRotation), view.weaponScale), [view.rightGripPosition, view.weaponRotation, view.weaponScale])
  const leftGripPosition = useMemo(() => scalePosition(applyWeaponRotation(view.leftGripPosition, view.weaponRotation), view.weaponScale), [view.leftGripPosition, view.weaponRotation, view.weaponScale])
  // Muzzle-to-stock along the barrel's actual angle: the cocking slide moves along this, so the pump reads as "along the barrel" at any tuned angle.
  const stockward = useMemo(() => applyWeaponRotation([1, 0, 0], view.weaponRotation), [view.weaponRotation])
  // Where the muzzle points at rest; the aim-follow rotates this onto the camera ray through the crosshair.
  const restingMuzzle = useMemo(() => new THREE.Vector3(...applyWeaponRotation([-1, 0, 0], view.weaponRotation)).normalize(), [view.weaponRotation])

  // Per-frame scratch, reused so the frame loop allocates nothing.
  const [scratch] = useState(() => ({ aimDirection: new THREE.Vector3(), aimQuaternion: new THREE.Quaternion() }))

  const aimGroup = useRef<THREE.Group>(null)
  const recoilGroup = useRef<THREE.Group>(null)
  const weaponModelGroup = useRef<THREE.Group>(null)
  const cockingGroup = useRef<THREE.Group>(null)
  const lastRecoilSignalRef = useRef(recoilSignal)
  const recoilStartMsRef = useRef<number | null>(null)
  const lastWeaponPhaseRef = useRef(weaponPhase)
  const reloadPlayedRef = useRef(false)
  // Seconds of rendering since mount, summed from frame deltas: the clock every motion here runs on.
  const elapsedRef = useRef(0)

  useFrame((state, delta) => {
    elapsedRef.current += delta
    const nowMs = elapsedRef.current * 1000
    if (lastRecoilSignalRef.current !== recoilSignal) {
      lastRecoilSignalRef.current = recoilSignal
      recoilStartMsRef.current = nowMs
    }
    if (weaponPhase === 'cocking' && lastWeaponPhaseRef.current !== 'cocking') reloadPlayedRef.current = false
    lastWeaponPhaseRef.current = weaponPhase

    const aim = aimGroup.current
    const recoilNode = recoilGroup.current
    if (aim === null || recoilNode === null) return

    // Aim: rotate the whole assembly so the muzzle converges on the camera ray through the crosshair.
    const fov = state.camera instanceof THREE.PerspectiveCamera ? state.camera.fov : 50
    const aspect = state.size.height > 0 ? state.size.width / state.size.height : 1
    writeAimRayDirection(aimNdc, fov, aspect, scratch.aimDirection)
    writeAimQuaternion(restingMuzzle, scratch.aimDirection, scratch.aimQuaternion)
    aim.quaternion.slerp(scratch.aimQuaternion, AIM_FOLLOW_SMOOTHING)
    aim.position.y = Math.sin(elapsedRef.current * 1.4) * (reducedMotion ? 0 : IDLE_SWAY_AMPLITUDE)

    // Recoil: weapon and both arms kick together via the shared parent.
    const recoilStart = recoilStartMsRef.current
    const recoil = recoilStart === null ? 0 : recoilAt(nowMs - recoilStart, weapon.recoilDurationMs, (reducedMotion ? 0.4 : 1) * weapon.recoilStrength)
    if (recoil === 0) recoilStartMsRef.current = null
    recoilNode.position.z = recoil * RECOIL_KICK_DISTANCE
    recoilNode.rotation.x = recoil * RECOIL_KICK_PITCH_RADIANS

    // Cocking: the weapon dips (the pump is fused to it) and the left hand slides back and forward, starting once recoil has settled.
    let cockingProgress = 0
    let cockingSettled = false
    if (weaponPhase === 'cocking' && cockingUntilMs !== null) {
      const cockingElapsed = cockingMs - (cockingUntilMs - elapsedMs)
      cockingProgress = computeVisualCockingProgress(cockingElapsed, cockingMs, weapon.recoilDurationMs)
      cockingSettled = cockingElapsed >= weapon.recoilDurationMs
    }
    const slide = cockingSlideAmount(cockingProgress)
    // Added to the weapon's own baseline pitch, which is part of its presentation angle: replacing it would pop the gun flat.
    if (weaponModelGroup.current) weaponModelGroup.current.rotation.x = view.weaponRotation[0] + slide * COCKING_WEAPON_DIP_RADIANS
    if (cockingGroup.current) {
      const distance = slide * view.cockingSlideDistance
      cockingGroup.current.position.set(leftGripPosition[0] + stockward[0] * distance, leftGripPosition[1] + stockward[1] * distance, leftGripPosition[2] + stockward[2] * distance)
    }

    // The reload cue waits for recoil to settle, so it doesn't land on top of the shot.
    if (cockingSettled && !reloadPlayedRef.current) {
      reloadPlayedRef.current = true
      onReloadStart()
    }
  })

  return (
    <group>
      {/* Parented to the camera, so the assembly stays screen-locked in the foreground. */}
      <primitive object={camera}>
        <group position={view.weaponPosition}>
          <group ref={aimGroup}>
            <group ref={recoilGroup}>
              <group ref={weaponModelGroup} scale={view.weaponScale} rotation={view.weaponRotation}>
                <AsyncBoundary
                  loading={null}
                  failed={() => <FallbackBlasterModel weaponScale={view.weaponScale} />}
                  onError={() => {
                    console.warn('[EquationBlaster] Equation Blaster GLB failed to load — using the placeholder gun.')
                  }}
                >
                  <ClonedGltf url={EQUATION_BLASTER_URL} />
                </AsyncBoundary>

                <group position={view.muzzlePosition}>
                  <MuzzleFlash triggerSignal={recoilSignal} reducedMotion={reducedMotion} />
                </group>
              </group>

              {!hideRightArm && (
                <group position={rightGripPosition}>
                  <group scale={view.rightArmScale} rotation={view.rightArmRotation}>
                    <AsyncBoundary
                      loading={null}
                      failed={() => null}
                      onError={() => {
                        console.warn('[EquationBlaster] Right-arm GLB failed to load — rendering without it.')
                      }}
                    >
                      <ClonedGltf url={RIGHT_ARM_URL} />
                    </AsyncBoundary>
                  </group>
                </group>
              )}

              {!hideLeftArm && (
                <group ref={cockingGroup} position={leftGripPosition}>
                  <group scale={view.leftArmScale} rotation={view.leftArmRotation}>
                    <AsyncBoundary
                      loading={null}
                      failed={() => null}
                      onError={() => {
                        console.warn('[EquationBlaster] Left-arm GLB failed to load — rendering without it.')
                      }}
                    >
                      <ClonedGltf url={LEFT_ARM_URL} />
                    </AsyncBoundary>
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
