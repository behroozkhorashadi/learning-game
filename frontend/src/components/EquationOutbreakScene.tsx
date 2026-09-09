import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { ZombieCharacter3D, type ZombieClipRole } from './ZombieCharacter3D'
import { AnswerLabel3D } from './AnswerLabel3D'
import { MathBlaster3D } from './MathBlaster3D'
import type { CharacterDefinition } from '../lib/characterDefinitions'
import type { WeaponDefinition } from '../lib/weaponDefinitions'
import { HIT_REACTION_LOCK_MS, type Carrier, type HitZone, type LastHit } from '../lib/zombieWaveEngine'

/**
 * The fixed-camera 3D shooting-gallery scene. This component (and its
 * children) only render engine state, perform raycasting, and play
 * animations — it never decides whether a shot counts; it just reports what
 * was hit to the parent, which is the only thing allowed to call into
 * `zombieWaveEngine`.
 *
 * Raycasting uses React Three Fiber's built-in pointer-event system rather
 * than a hand-rolled `THREE.Raycaster`: each hitbox mesh gets `onPointerDown`,
 * and the `<Canvas>` itself gets `onPointerMissed` for background misses.
 * Both fire from the same real pointer event R3F already tracks, so the
 * crosshair (an HTML overlay sharing the same tracked pointer position) and
 * the raycast are aligned by construction — mouse and touch both work
 * through the same Pointer Events-based mechanism with no special-casing.
 *
 * Hitboxes are anchored at a fixed local offset within each zombie's own
 * group rather than literally parented to the animated head/torso bones —
 * a deliberate "forgiving hitbox" simplification (explicitly permitted by
 * the spec) justified by the asset audit's finding that the approach/idle
 * clips have near-zero net bone drift, so a fixed offset stays aligned
 * throughout normal gameplay.
 */

export type WavePhase = 'intro' | 'playing' | 'frozen'

const LANE_X = [-2.6, -0.9, 0.9, 2.6]
const SPAWN_Z = -13
// Camera sits at z=3 (see PerspectiveCamera below) — 0.5 puts the danger
// line close enough to loom large at contact, instead of the old -2.5 which
// left a large, flat-feeling gap before "contact."
const DANGER_Z = 0.5
const LANE_COLORS = ['#9D57FA', '#144FFF', '#5BCC2D', '#F59E0B']

function laneToPosition(lane: number, distance: number): [number, number, number] {
  const z = THREE.MathUtils.lerp(SPAWN_Z, DANGER_Z, distance)
  return [LANE_X[lane] ?? 0, 0, z]
}

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
  character: CharacterDefinition
  phase: WavePhase
  speedMultiplier: number
  phaseOffsetSeconds: number
  lastHit: LastHit | null
  onHit: (carrierId: string, zone: HitZone) => void
}

function ZombieInstance({ carrier, character, phase, speedMultiplier, phaseOffsetSeconds, lastHit, onHit }: ZombieInstanceProps) {
  const [reacting, setReacting] = useState(false)
  const groupRef = useRef<THREE.Group>(null!)

  // The outer group's position is the sole source of truth for where a
  // zombie sits along its lane — see `laneToPosition`, driven by the wave
  // engine's authoritative `carrier.distance`. It's set imperatively (via
  // `useFrame` below) rather than as a declarative `position` prop so a
  // knockback's backward push can be eased over `HIT_REACTION_LOCK_MS`
  // instead of teleporting the moment the engine updates `distance`. The
  // skeletal clip itself never moves this group — see `lib/rootMotion.ts`
  // for how `Hit_Reaction`'s baked-in lateral root motion is neutralized so
  // it can't fight this.
  const visualDistanceRef = useRef(carrier.distance)
  const knockbackRef = useRef<{ from: number; startedAt: number } | null>(null)

  useLayoutEffect(() => {
    const [x, y, z] = laneToPosition(carrier.lane, visualDistanceRef.current)
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
    const [x, y, z] = laneToPosition(carrier.lane, visualDistance)
    groupRef.current.position.set(x, y, z)
  })

  const clipRole = resolveClipRole(carrier, phase, reacting)
  const speed = clipRole === 'approach' ? speedMultiplier : 1
  const canBeHit = carrier.status === 'active'
  const labelColor = LANE_COLORS[carrier.lane % LANE_COLORS.length]

  function handlePointerDown(zone: HitZone) {
    return (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      onHit(carrier.id, zone)
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
          <mesh position={[0, character.hitbox.headCenterY, 0]} onPointerDown={handlePointerDown('head')}>
            <sphereGeometry args={[character.hitbox.headRadius, 12, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh position={[0, character.hitbox.torsoCenterY, 0]} onPointerDown={handlePointerDown('body')}>
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
}: Props) {
  const phaseOffsets = useRef<Record<string, number>>({})
  for (const carrier of carriers) {
    if (!(carrier.id in phaseOffsets.current)) {
      phaseOffsets.current[carrier.id] = Math.random() * 2
    }
  }

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.55, 3]} fov={55} near={0.1} far={40} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 6, 2]} intensity={1.1} castShadow={!reducedMotion} />
      <hemisphereLight args={['#CBB8F2', '#3B2F5C', 0.5]} />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -6]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#8B7BC9" roughness={0.9} />
      </mesh>

      {/* danger line — a clear player boundary marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, DANGER_Z]}>
        <planeGeometry args={[8, 0.08]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.6} />
      </mesh>

      {/* soft atmospheric backdrop */}
      <mesh position={[0, 4, SPAWN_Z - 2]}>
        <planeGeometry args={[30, 14]} />
        <meshBasicMaterial color="#A98FE0" />
      </mesh>

      <fog attach="fog" args={['#A98FE0', 8, 22]} />

      {carriers.map((carrier) => (
        <ZombieInstance
          key={carrier.id}
          carrier={carrier}
          character={character}
          phase={phase}
          speedMultiplier={speedMultiplier}
          phaseOffsetSeconds={phaseOffsets.current[carrier.id] ?? 0}
          lastHit={lastHit}
          onHit={onHit}
        />
      ))}

      <MathBlaster3D weapon={weapon} aimNdc={aimNdc} recoilSignal={recoilSignal} reducedMotion={reducedMotion} />
    </>
  )
}
