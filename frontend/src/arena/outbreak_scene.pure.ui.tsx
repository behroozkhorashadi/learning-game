import { PerspectiveCamera } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState, type ReactElement } from 'react'
import type * as THREE from 'three'
import type { WeaponViewConfig } from '@app/blaster/blaster_config.pure.lib.ts'
import { EquationBlaster } from '@app/blaster/equation_blaster.pure.ui.tsx'
import type { WeaponDefinition } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { ScienceFairEnvironment } from '@app/science_fair/science_fair_environment.pure.ui.tsx'
import { AnswerLabel3D } from '@app/zombies/answer_label_3d.pure.ui.tsx'
import { SCIENTIST_ZOMBIE, type CharacterDefinition } from '@app/zombies/character_definitions.pure.lib.ts'
import { ZombieCharacter3D } from '@app/zombies/zombie_character_3d.pure.ui.tsx'
import type { Carrier, HitZone, WeaponPhase } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import { buildLanes, computeLaneLayout, laneAt, positionAlongLane, type Lane } from './lane_navigation.pure.lib.ts'
import { LaneDebugOverlay } from './lane_debug_overlay.pure.ui.tsx'
import { clipRoleFor, laneColor, sceneFov, walkPhaseFor, type WavePhase } from './outbreak_scene_rules.pure.lib.ts'
import { resolveRaycastOutcome } from './raycast_outcome.pure.lib.ts'
import { classifyIntersections } from './raycast_tags.pure.lib.ts'
import { useZombieHitTarget } from './use_zombie_hit_target.pure.hook.ts'

/**
 * The fixed-camera 3D shooting gallery, dressed as "Outbreak at the Science
 * Fair", plus the zombies. This scene only renders engine state, raycasts,
 * and plays animations: it never decides whether a shot counts, it reports
 * what was hit to the arena, the only caller of the wave engine.
 *
 * Raycasting is R3F's pointer events, not a hand-rolled raycaster. Every hit
 * target (a zombie's model meshes, or an environment prop's invisible
 * collider) is tagged (raycast_tags), and its handler resolves the shot with
 * `resolveRaycastOutcome` over every intersection: the nearest tagged object
 * wins, a collider in front of a zombie blocks the shot (a miss: no damage,
 * no telemetry, cocking still applies), and untagged geometry never takes
 * part. The <Canvas>'s `onPointerMissed` covers "hit nothing at all". Both
 * paths call the same `onHit`/`onMiss`, so cocking and telemetry stay single-sourced.
 */

export interface OutbreakSceneProps {
  readonly carriers: readonly Carrier[]
  /** This wave's character per lane (0..3): a rendering choice the wave engine has no opinion on. */
  readonly charactersByLane: readonly CharacterDefinition[]
  readonly weapon: WeaponDefinition
  readonly phase: WavePhase
  readonly speedMultiplier: number
  readonly aimNdc: { readonly x: number; readonly y: number } | null
  readonly reducedMotion: boolean
  readonly recoilSignal: number
  readonly weaponPhase: WeaponPhase
  readonly cockingUntilMs: number | null
  readonly elapsedMs: number
  readonly cockingMs: number
  readonly onHit: (carrierId: string, zone: HitZone) => void
  readonly onMiss: () => void
  /** Fires once per cocking, as the reload motion starts. */
  readonly onReloadStart: () => void
  /** Dev-only lane and collider wireframes. */
  readonly debugLanes?: boolean
  /** Dev-only live weapon pose; see the weapon tuning panel. */
  readonly weaponView?: WeaponViewConfig | undefined
  readonly hideRightArm?: boolean
  readonly hideLeftArm?: boolean
  /** Dev-only (hit lab): pin every zombie's walk phase so a frozen pose is reproducible. */
  readonly fixedPhaseOffsetSeconds?: number
  /** Told once each zombie's model has loaded and is a hit target (the hit lab waits on this). */
  readonly onZombieReady?: (carrierId: string) => void
}

interface ZombieInstanceProps {
  readonly carrier: Carrier
  readonly lane: Lane
  readonly character: CharacterDefinition
  readonly phase: WavePhase
  readonly speedMultiplier: number
  readonly phaseOffsetSeconds: number
  readonly onHit: (carrierId: string, zone: HitZone) => void
  readonly onMiss: () => void
  readonly onReady: ((carrierId: string) => void) | undefined
}

function ZombieInstance({ carrier, lane, character, phase, speedMultiplier, phaseOffsetSeconds, onHit, onMiss, onReady }: ZombieInstanceProps): ReactElement {
  const groupRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group>(null)
  // A fresh clone (this lane's character changed) bumps the version, so its new meshes are tagged rather than left unhittable.
  const [rig, setRig] = useState<{ readonly head: THREE.Object3D | null; readonly version: number }>({ head: null, version: 0 })
  const canBeHit = carrier.status === 'active'
  useZombieHitTarget(groupRef, modelRef, { lane, distance: carrier.distance, carrierId: carrier.id, canBeHit, headBone: rig.head, rigVersion: rig.version })

  const clipRole = clipRoleFor(carrier, phase)

  function handlePointerDown(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation()
    // The true nearest hit (this zombie, one in front of it, or a collider) comes from every intersection, not from which handler fired.
    const outcome = resolveRaycastOutcome(classifyIntersections(event.intersections))
    if (outcome.type === 'zombie') onHit(outcome.meta.carrierId, outcome.meta.zone)
    else if (outcome.type === 'blocked') onMiss()
  }

  return (
    <group ref={groupRef} name={`zombie-${carrier.id}`}>
      <group ref={modelRef} {...(canBeHit ? { onPointerDown: handlePointerDown } : {})}>
        <ZombieCharacter3D
          character={character}
          clipRole={clipRole}
          speed={clipRole === 'approach' ? speedMultiplier : 1}
          phaseOffsetSeconds={phaseOffsetSeconds}
          onBonesReady={(bones) => {
            setRig((previous) => ({ head: bones.head, version: previous.version + 1 }))
            onReady?.(carrier.id)
          }}
        />
      </group>

      <group position={[0, character.answerLabelYOffset, 0]}>
        <AnswerLabel3D label={carrier.label} color={laneColor(carrier.lane)} hidden={carrier.status === 'defeated'} />
      </group>
    </group>
  )
}

export function OutbreakScene({
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
  onReloadStart,
  debugLanes = false,
  weaponView,
  hideRightArm = false,
  hideLeftArm = false,
  fixedPhaseOffsetSeconds,
  onZombieReady,
}: OutbreakSceneProps): ReactElement {
  // Lane spacing (and, mildly, the FOV) follow the canvas aspect so all four lanes stay in frame at any size. Rendering only: the engine's lanes don't change.
  const aspectRatio = useThree((state) => state.size.width / Math.max(1, state.size.height))
  const lanes = useMemo(() => buildLanes(computeLaneLayout(aspectRatio)), [aspectRatio])

  const activeCarrierPositions = debugLanes ? carriers.filter((c) => c.status === 'active').map((c) => ({ lane: c.lane, position: positionAlongLane(laneAt(lanes, c.lane), c.distance) })) : []

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.55, 3]} fov={sceneFov(aspectRatio)} near={0.1} far={40} />

      <ScienceFairEnvironment lanes={lanes} reducedMotion={reducedMotion} onBlockedShot={onMiss} />

      {debugLanes && <LaneDebugOverlay lanes={lanes} activeCarrierPositions={activeCarrierPositions} />}

      {carriers.map((carrier) => (
        <ZombieInstance
          key={carrier.id}
          carrier={carrier}
          lane={laneAt(lanes, carrier.lane)}
          character={charactersByLane[carrier.lane] ?? SCIENTIST_ZOMBIE}
          phase={phase}
          speedMultiplier={speedMultiplier}
          phaseOffsetSeconds={fixedPhaseOffsetSeconds ?? walkPhaseFor(carrier.id)}
          onHit={onHit}
          onMiss={onMiss}
          onReady={onZombieReady}
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
        onReloadStart={onReloadStart}
        weaponView={weaponView}
        hideRightArm={hideRightArm}
        hideLeftArm={hideLeftArm}
      />
    </>
  )
}
