import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ZombieCharacter3D, type ZombieClipRole } from './ZombieCharacter3D'
import { AnswerLabel3D } from './AnswerLabel3D'
import { EquationBlaster } from './EquationBlaster'
import { ScienceFairEnvironment } from './ScienceFairEnvironment'
import { LaneDebugOverlay } from './LaneDebugOverlay'
import { collectRaycastHits, type RaycastUserData } from './EnvironmentCollider'
import { resolveRaycastOutcome } from '../lib/raycastOutcome'
import { buildLanes, computeLaneLayout, positionAlongLane, type Lane, type Vec3 } from '../lib/laneNavigation'
import { SCIENTIST_ZOMBIE, type CharacterDefinition } from '../lib/characterDefinitions'
import type { WeaponDefinition } from '../lib/weaponDefinitions'
import type { WeaponViewConfig } from '../lib/equationBlasterConfig'
import type { Carrier, HitZone, WeaponPhase as EngineWeaponPhase } from '../lib/zombieWaveEngine'

/**
 * The fixed-camera 3D shooting-gallery scene — now dressed as "Outbreak at
 * the Science Fair" (see `ScienceFairEnvironment`) — plus the zombies
 * themselves. This component (and its children) only render engine state,
 * perform raycasting, and play animations — it never decides whether a
 * shot counts; it just reports what was hit to the parent, which is the
 * only thing allowed to call into `zombieWaveEngine`.
 *
 * Raycasting uses React Three Fiber's built-in pointer-event system rather
 * than a hand-rolled `THREE.Raycaster`: every hit target (a zombie's own
 * model mesh, or a solid environment prop's invisible collider — see
 * `EnvironmentCollider.tsx`) is tagged via `userData.raycastKind`, and its
 * handler calls the same pure `resolveRaycastOutcome` this file's tests and
 * `raycastOutcome.test.ts` both exercise: whichever tagged object is
 * nearest along the ray wins, an environment collider in front of a zombie
 * blocks the shot (treated as a miss — no damage, no telemetry, cooldown
 * still applies), and untagged/debug geometry never participates. The
 * `<Canvas>` itself still gets `onPointerMissed` for the "hit literally
 * nothing" case. Both paths funnel into the same `onHit`/`onMiss` the
 * parent already uses, so cooldown and telemetry stay single-sourced.
 *
 * A zombie is hit-tested against its actual skinned mesh in its current
 * animated pose (three.js applies bone transforms when raycasting a
 * SkinnedMesh), so hair, hats, hands and feet all count — what you see is
 * what you can hit. Head vs. body is decided per shot by whether the hit
 * point is above the `Head` bone. This replaced a fixed head sphere + torso
 * capsule that, measured in the dev hit lab (`?screen=zombie-hit-lab`), sat
 * roughly a head-height too low and missed the head, legs and feet.
 */

export type WavePhase = 'intro' | 'playing' | 'frozen'

const LANE_COLORS = ['#9D57FA', '#144FFF', '#5BCC2D', '#F59E0B']

// 'hitReact' is still a valid clip role a `CharacterDefinition` can map (see
// `characterDefinitions.ts`) — every current GLB embeds a usable `Hit_Reaction`
// clip — but with every hit now a one-shot defeat (see `zombieWaveEngine.ts`),
// there is no "hit but survives" carrier state left to trigger it from during
// normal gameplay.
function resolveClipRole(carrier: Carrier, phase: WavePhase): ZombieClipRole {
  if (carrier.status === 'reached_player') return 'reach'
  if (carrier.status === 'defeated') return carrier.defeatedBy === 'headshot' ? 'deadHeadshot' : 'deadBody'
  if (phase === 'intro') return 'idle'
  return 'approach'
}

interface ZombieInstanceProps {
  carrier: Carrier
  lane: Lane
  character: CharacterDefinition
  phase: WavePhase
  speedMultiplier: number
  phaseOffsetSeconds: number
  onHit: (carrierId: string, zone: HitZone) => void
  onMiss: () => void
}

// The skinned mesh's bounding sphere is computed once (from whatever pose
// it's in at the time) and then reused as the raycast early-out; padding it
// keeps a later pose — an arm swung forward mid-stride — from being culled.
const BOUNDING_SPHERE_PADDING = 1.5

function ZombieInstance({ carrier, lane, character, phase, speedMultiplier, phaseOffsetSeconds, onHit, onMiss }: ZombieInstanceProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const modelRef = useRef<THREE.Group>(null!)
  const headBoneRef = useRef<THREE.Object3D | null>(null)

  // The outer group's position is the sole source of truth for where a
  // zombie sits along its lane — see `positionAlongLane`, driven by the
  // wave engine's authoritative `carrier.distance` mapped onto this
  // carrier's lane path (`laneNavigation.ts`). Set imperatively (via
  // `useFrame` below) rather than as a declarative `position` prop to avoid
  // per-frame React reconciliation on every carrier for the whole approach.
  useLayoutEffect(() => {
    const [x, y, z] = positionAlongLane(lane, carrier.distance)
    groupRef.current.position.set(x, y, z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => {
    const [x, y, z] = positionAlongLane(lane, carrier.distance)
    groupRef.current.position.set(x, y, z)
  })

  const clipRole = resolveClipRole(carrier, phase)
  const speed = clipRole === 'approach' ? speedMultiplier : 1
  const canBeHit = carrier.status === 'active'
  const labelColor = LANE_COLORS[carrier.lane % LANE_COLORS.length]

  // Tag the model's own meshes as this carrier's hit target while it's
  // hittable; untagged (defeated) meshes are ignored by `resolveRaycastOutcome`.
  useLayoutEffect(() => {
    const headWorld = new THREE.Vector3()
    function zoneAt(point: THREE.Vector3): HitZone {
      const head = headBoneRef.current
      if (!head) return 'body'
      head.getWorldPosition(headWorld)
      return point.y >= headWorld.y ? 'head' : 'body'
    }
    modelRef.current.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return
      const tag: RaycastUserData = canBeHit ? { raycastKind: 'zombie', carrierId: carrier.id, zoneAt } : {}
      obj.userData = tag
      const skinned = obj as THREE.SkinnedMesh
      if (canBeHit && skinned.isSkinnedMesh) {
        skinned.computeBoundingSphere()
        skinned.boundingSphere!.radius *= BOUNDING_SPHERE_PADDING
      }
    })
  }, [canBeHit, carrier.id])

  // The true nearest hit (this zombie, another zombie in front of it, or an
  // environment collider) comes from `resolveRaycastOutcome` over every
  // intersection, not from which handler happened to fire.
  function handleHitboxPointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation()
    const outcome = resolveRaycastOutcome(collectRaycastHits(event))
    if (outcome.type === 'zombie' && outcome.meta) {
      onHit(outcome.meta.carrierId, outcome.meta.zone)
    } else if (outcome.type === 'blocked') {
      onMiss()
    }
  }

  return (
    <group ref={groupRef}>
      <group ref={modelRef} onPointerDown={canBeHit ? handleHitboxPointerDown : undefined}>
        <ZombieCharacter3D
          character={character}
          clipRole={clipRole}
          speed={speed}
          phaseOffsetSeconds={phaseOffsetSeconds}
          onBonesReady={(bones) => {
            headBoneRef.current = bones.head
          }}
        />
      </group>

      <group position={[0, character.answerLabelYOffset, 0]}>
        <AnswerLabel3D label={carrier.label} color={labelColor} hidden={carrier.status === 'defeated'} />
      </group>
    </group>
  )
}

interface Props {
  carriers: Carrier[]
  /** This wave's character for each lane (index 0..3) — chosen by
   * `ZombieMathBlaster` from the session roster (`lib/zombieRoster.ts`),
   * shuffled per wave. Never a single shared character: which model a lane
   * gets is purely a rendering choice the wave engine has no opinion on. */
  charactersByLane: CharacterDefinition[]
  weapon: WeaponDefinition
  phase: WavePhase
  speedMultiplier: number
  aimNdc: { x: number; y: number } | null
  reducedMotion: boolean
  recoilSignal: number
  weaponPhase: EngineWeaponPhase
  cockingUntilMs: number | null
  elapsedMs: number
  cockingMs: number
  onHit: (carrierId: string, zone: HitZone) => void
  onMiss: () => void
  /** Dev-only navigation/collision visualization — see `LaneDebugOverlay`.
   * Always `false` outside `import.meta.env.DEV`. */
  debugLanes?: boolean
  /** Dev-only live weapon-pose override — see `EquationBlaster`'s own
   * `weaponView` prop and `WeaponTuningPanel` in `ZombieMathBlaster.tsx`. */
  weaponView?: WeaponViewConfig
  hideRightArm?: boolean
  hideLeftArm?: boolean
  /** Dev-only (hit lab): pin every zombie's animation phase instead of the
   * per-carrier random one, so a frozen pose is reproducible. */
  fixedPhaseOffsetSeconds?: number
}

export function EquationOutbreakScene({
  carriers,
  charactersByLane,
  weapon,
  phase,
  speedMultiplier,
  aimNdc,
  reducedMotion,
  recoilSignal,
  weaponPhase,
  cockingUntilMs,
  elapsedMs,
  cockingMs,
  onHit,
  onMiss,
  debugLanes = false,
  weaponView,
  hideRightArm = false,
  hideLeftArm = false,
  fixedPhaseOffsetSeconds,
}: Props) {
  const phaseOffsets = useRef<Record<string, number>>({})
  for (const carrier of carriers) {
    if (!(carrier.id in phaseOffsets.current)) {
      phaseOffsets.current[carrier.id] = Math.random() * 2
    }
  }

  // Lane spacing (and, mildly, camera FOV) respond to the canvas's own
  // aspect ratio so all four lanes stay in frame at any viewport size —
  // see `computeLaneLayout`. This is purely a rendering concern: the wave
  // engine's `Carrier.lane`/`distance` never change shape here.
  const { width, height } = useThree((state) => state.size)
  const aspectRatio = width / height
  const lanes = useMemo(() => buildLanes(computeLaneLayout(aspectRatio)), [aspectRatio])
  const fov = THREE.MathUtils.clamp(THREE.MathUtils.lerp(64, 50, (aspectRatio - 0.6) / (1.8 - 0.6)), 50, 64)

  function handleEnvironmentBlocked() {
    onMiss()
  }

  const activeCarrierPositions = debugLanes
    ? carriers.filter((c) => c.status === 'active').map((c) => ({ lane: c.lane, position: positionAlongLane(lanes[c.lane] ?? lanes[0], c.distance) as Vec3 }))
    : []

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.55, 3]} fov={fov} near={0.1} far={40} />

      <ScienceFairEnvironment lanes={lanes} reducedMotion={reducedMotion} onBlockedShot={handleEnvironmentBlocked} />

      {debugLanes && <LaneDebugOverlay lanes={lanes} activeCarrierPositions={activeCarrierPositions} />}

      {carriers.map((carrier) => (
        <ZombieInstance
          key={carrier.id}
          carrier={carrier}
          lane={lanes[carrier.lane] ?? lanes[0]}
          character={charactersByLane[carrier.lane] ?? SCIENTIST_ZOMBIE}
          phase={phase}
          speedMultiplier={speedMultiplier}
          phaseOffsetSeconds={fixedPhaseOffsetSeconds ?? phaseOffsets.current[carrier.id] ?? 0}
          onHit={onHit}
          onMiss={onMiss}
        />
      ))}

      <EquationBlaster
        weapon={weapon}
        weaponPhase={weaponPhase}
        cockingUntilMs={cockingUntilMs}
        elapsedMs={elapsedMs}
        cockingMs={cockingMs}
        recoilSignal={recoilSignal}
        aimNdc={aimNdc}
        reducedMotion={reducedMotion}
        weaponView={weaponView}
        hideRightArm={hideRightArm}
        hideLeftArm={hideLeftArm}
      />
    </>
  )
}
