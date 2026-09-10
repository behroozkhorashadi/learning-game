import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ZombieCharacter3D, type ZombieClipRole } from './ZombieCharacter3D'
import { AnswerLabel3D } from './AnswerLabel3D'
import { MathBlaster3D } from './MathBlaster3D'
import { ScienceFairEnvironment } from './ScienceFairEnvironment'
import { LaneDebugOverlay } from './LaneDebugOverlay'
import { collectRaycastHits } from './EnvironmentCollider'
import { resolveRaycastOutcome } from '../lib/raycastOutcome'
import { buildLanes, computeLaneLayout, positionAlongLane, type Lane, type Vec3 } from '../lib/laneNavigation'
import type { CharacterDefinition } from '../lib/characterDefinitions'
import type { WeaponDefinition } from '../lib/weaponDefinitions'
import { HIT_REACTION_LOCK_MS, type Carrier, type HitZone, type LastHit } from '../lib/zombieWaveEngine'

/**
 * The fixed-camera 3D shooting-gallery scene — now dressed as "Outbreak at
 * the Science Fair" (see `ScienceFairEnvironment`) — plus the zombies
 * themselves. This component (and its children) only render engine state,
 * perform raycasting, and play animations — it never decides whether a
 * shot counts; it just reports what was hit to the parent, which is the
 * only thing allowed to call into `zombieWaveEngine`.
 *
 * Raycasting uses React Three Fiber's built-in pointer-event system rather
 * than a hand-rolled `THREE.Raycaster`: every hitbox (a zombie's head/body,
 * or a solid environment prop's invisible collider — see
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
 * Hitboxes are anchored at a fixed local offset within each zombie's own
 * group rather than literally parented to the animated head/torso bones —
 * a deliberate "forgiving hitbox" simplification (explicitly permitted by
 * the spec) justified by the asset audit's finding that the approach/idle
 * clips have near-zero net bone drift, so a fixed offset stays aligned
 * throughout normal gameplay.
 */

export type WavePhase = 'intro' | 'playing' | 'frozen'

const LANE_COLORS = ['#9D57FA', '#144FFF', '#5BCC2D', '#F59E0B']

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function resolveClipRole(carrier: Carrier, phase: WavePhase, reacting: boolean): ZombieClipRole {
  if (carrier.status === 'reached_player') return 'reach'
  if (carrier.status === 'defeated') return carrier.defeatedBy === 'headshot' ? 'deadHeadshot' : 'deadBody'
  if (reacting) return 'hitReact'
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
  lastHit: LastHit | null
  onHit: (carrierId: string, zone: HitZone) => void
  onMiss: () => void
}

function ZombieInstance({ carrier, lane, character, phase, speedMultiplier, phaseOffsetSeconds, lastHit, onHit, onMiss }: ZombieInstanceProps) {
  const [reacting, setReacting] = useState(false)
  const groupRef = useRef<THREE.Group>(null!)

  // The outer group's position is the sole source of truth for where a
  // zombie sits along its lane — see `positionAlongLane`, driven by the
  // wave engine's authoritative `carrier.distance` mapped onto this
  // carrier's lane path (`laneNavigation.ts`). It's set imperatively (via
  // `useFrame` below) rather than as a declarative `position` prop so a
  // knockback's backward push can be eased over `HIT_REACTION_LOCK_MS`
  // instead of teleporting the moment the engine updates `distance`. The
  // skeletal clip itself never moves this group — see `lib/rootMotion.ts`
  // for how `Hit_Reaction`'s baked-in lateral root motion is neutralized so
  // it can't fight this, and never moves it off the lane's own path, so a
  // knocked-back zombie always stays on the same valid corridor.
  const visualDistanceRef = useRef(carrier.distance)
  const knockbackRef = useRef<{ from: number; startedAt: number } | null>(null)

  useLayoutEffect(() => {
    const [x, y, z] = positionAlongLane(lane, visualDistanceRef.current)
    groupRef.current.position.set(x, y, z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (lastHit && lastHit.carrierId === carrier.id && !lastHit.defeated) {
      setReacting(true)
      if (lastHit.zone === 'body') {
        // Ease from wherever this zombie was actually rendered (not
        // `carrier.distance`, which is already the post-knockback value by
        // the time this effect runs) back to the new, reduced distance.
        knockbackRef.current = { from: visualDistanceRef.current, startedAt: performance.now() }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastHit])

  useFrame(() => {
    let visualDistance = carrier.distance
    const knockback = knockbackRef.current
    if (knockback) {
      const t = Math.min(1, (performance.now() - knockback.startedAt) / HIT_REACTION_LOCK_MS)
      visualDistance = THREE.MathUtils.lerp(knockback.from, carrier.distance, easeOutCubic(t))
      if (t >= 1) knockbackRef.current = null
    }
    visualDistanceRef.current = visualDistance
    const [x, y, z] = positionAlongLane(lane, visualDistance)
    groupRef.current.position.set(x, y, z)
  })

  const clipRole = resolveClipRole(carrier, phase, reacting)
  const speed = clipRole === 'approach' ? speedMultiplier : 1
  const canBeHit = carrier.status === 'active'
  const labelColor = LANE_COLORS[carrier.lane % LANE_COLORS.length]

  // Both hitbox meshes below share this one handler rather than each
  // hardcoding their own zone: the true nearest hit (head vs. body, or an
  // environment collider in front of either) comes from
  // `resolveRaycastOutcome`, which the two hitboxes could otherwise
  // disagree with if they geometrically overlap along the ray.
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
      <ZombieCharacter3D
        character={character}
        clipRole={clipRole}
        speed={speed}
        phaseOffsetSeconds={phaseOffsetSeconds}
        onClipFinished={() => setReacting(false)}
      />

      {canBeHit && (
        <>
          <mesh position={[0, character.hitbox.headCenterY, 0]} userData={{ raycastKind: 'zombie', carrierId: carrier.id, zone: 'head' }} onPointerDown={handleHitboxPointerDown}>
            <sphereGeometry args={[character.hitbox.headRadius, 12, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh
            position={[0, character.hitbox.torsoCenterY, 0]}
            userData={{ raycastKind: 'zombie', carrierId: carrier.id, zone: 'body' }}
            onPointerDown={handleHitboxPointerDown}
          >
            <capsuleGeometry args={[character.hitbox.torsoRadius, character.hitbox.torsoHeight, 4, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </>
      )}

      <group position={[0, character.answerLabelYOffset, 0]}>
        <AnswerLabel3D value={carrier.value} color={labelColor} hidden={carrier.status === 'defeated'} />
      </group>
    </group>
  )
}

interface Props {
  carriers: Carrier[]
  character: CharacterDefinition
  weapon: WeaponDefinition
  phase: WavePhase
  speedMultiplier: number
  lastHit: LastHit | null
  aimNdc: { x: number; y: number } | null
  reducedMotion: boolean
  recoilSignal: number
  onHit: (carrierId: string, zone: HitZone) => void
  onMiss: () => void
  /** Dev-only navigation/collision visualization — see `LaneDebugOverlay`.
   * Always `false` outside `import.meta.env.DEV`. */
  debugLanes?: boolean
}

export function EquationOutbreakScene({
  carriers,
  character,
  weapon,
  phase,
  speedMultiplier,
  lastHit,
  aimNdc,
  reducedMotion,
  recoilSignal,
  onHit,
  onMiss,
  debugLanes = false,
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
          character={character}
          phase={phase}
          speedMultiplier={speedMultiplier}
          phaseOffsetSeconds={phaseOffsets.current[carrier.id] ?? 0}
          lastHit={lastHit}
          onHit={onHit}
          onMiss={onMiss}
        />
      ))}

      <MathBlaster3D weapon={weapon} aimNdc={aimNdc} recoilSignal={recoilSignal} reducedMotion={reducedMotion} />
    </>
  )
}
