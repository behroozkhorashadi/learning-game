import { PerspectiveCamera } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState, type ReactElement } from 'react'
import * as THREE from 'three'
import { walkPhaseFor } from '@app/arena/outbreak_scene_rules.pure.lib.ts'
import { resolveRaycastOutcome } from '@app/arena/raycast_outcome.pure.lib.ts'
import { EquationBlaster } from '@app/blaster/equation_blaster.pure.ui.tsx'
import type { WeaponDefinition } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { unitBoxGeometry, unitSphereGeometry, unitTorusGeometry } from '@app/science_fair/shared_geometry.pure.lib.ts'
import { SCIENTIST_ZOMBIE, type CharacterDefinition } from '@app/zombies/character_definitions.pure.lib.ts'
import { ZombieCharacter3D } from '@app/zombies/zombie_character_3d.pure.ui.tsx'
import type { WeaponPhase } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import { GRENADE, type ArmTint, type ImpactStyle } from './horde_armory.pure.lib.ts'
import { isTargetable, type Blast, type HordeZombie, type Impact, type Projectile } from './horde_engine.pure.lib.ts'
import { HordeEnvironment } from './horde_environment.pure.ui.tsx'
import { CAMERA_POSITION, fieldPoint, worldPosition, type Cover } from './horde_field.pure.lib.ts'
import { classifyHordeIntersections, type HordeHitMeta } from './horde_raycast.pure.lib.ts'
import { blastProgress, clipRoleFor, healthFraction, impactPosition, impactProgress, impactStyleFor, isDrawn, projectilePosition, slotColor } from './horde_scene_rules.pure.lib.ts'
import { HordeZombieLabel } from './horde_zombie_label.pure.ui.tsx'
import { useHordeZombieTarget } from './use_horde_zombie_target.pure.hook.ts'

/**
 * Zombie Horde's 3D view: a fixed camera over a wide field, cover, the roaming
 * zombies with their answers and health, thrown objects, grenade blasts, hit
 * effects in the loaded rounds' style, and the first-person blaster. It renders engine state and reports shots; it
 * never decides what a shot does.
 *
 * One click handler on the whole field: R3F raycasts everything under it, and
 * the handler resolves the shot over every intersection (nearest zombie or
 * cover wins; cover blocks). With a grenade armed, the click instead lands a
 * grenade where the ray meets the floor.
 */

export interface HordeSceneProps {
  /** One per slot. */
  readonly zombies: readonly HordeZombie[]
  /** The answer each zombie shows (same order as `zombies`), or null. */
  readonly answers: readonly (string | null)[]
  /** This round's character per slot. */
  readonly characters: readonly CharacterDefinition[]
  readonly projectiles: readonly Projectile[]
  readonly blasts: readonly Blast[]
  readonly impacts: readonly Impact[]
  /** How a hit with the loaded special rounds looks (standard rounds always spark). */
  readonly impactStyle: ImpactStyle
  readonly elapsedMs: number
  readonly cover: readonly Cover[]
  readonly shadows: boolean
  readonly weapon: WeaponDefinition
  /** The worn armor skin's tint over the arms; null for none. */
  readonly armTint: ArmTint | null
  readonly weaponPhase: WeaponPhase
  readonly cockingUntilMs: number | null
  readonly cockingMs: number
  readonly recoilSignal: number
  readonly aimNdc: { readonly x: number; readonly y: number } | null
  readonly reducedMotion: boolean
  readonly grenadeArmed: boolean
  /** A shot resolved: the zombie and zone it hit (or null for a miss or a shot blocked by cover), and the cover that blocked it, if any. */
  readonly onShot: (target: HordeHitMeta | null, blockedBy: string | null) => void
  readonly onGrenade: (at: { readonly x: number; readonly depth: number }) => void
  readonly onReloadStart: () => void
  /** Told once each zombie's model has loaded and is a hit target. */
  readonly onZombieReady?: (zombieId: string) => void
}

interface ZombieInstanceProps {
  readonly zombie: HordeZombie
  readonly answer: string | null
  readonly character: CharacterDefinition
  readonly onReady: ((zombieId: string) => void) | undefined
}

function ZombieInstance({ zombie, answer, character, onReady }: ZombieInstanceProps): ReactElement {
  const groupRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group>(null)
  const [rig, setRig] = useState<{ readonly head: THREE.Object3D | null; readonly hips: THREE.Object3D | null; readonly version: number }>({ head: null, hips: null, version: 0 })
  const canBeHit = isTargetable(zombie)
  useHordeZombieTarget(groupRef, modelRef, { zombieId: zombie.id, x: zombie.x, depth: zombie.depth, heading: zombie.heading, canBeHit, headBone: rig.head, hipsBone: rig.hips, rigVersion: rig.version })
  const lying = zombie.posture === 'downed' || zombie.posture === 'rising'

  return (
    <group ref={groupRef} name={`zombie-${zombie.id}`}>
      <group ref={modelRef}>
        <ZombieCharacter3D
          character={character}
          clipRole={clipRoleFor(zombie)}
          phaseOffsetSeconds={walkPhaseFor(zombie.id)}
          onBonesReady={(bones) => {
            setRig((previous) => ({ head: bones.head, hips: modelRef.current?.getObjectByName(character.rootBoneName) ?? null, version: previous.version + 1 }))
            onReady?.(zombie.id)
          }}
        />
      </group>
      {canBeHit && (
        <group position={[0, lying ? 1.1 : character.answerLabelYOffset, 0]}>
          <HordeZombieLabel answer={answer} color={slotColor(zombie.slot)} health={healthFraction(zombie)} />
        </group>
      )}
    </group>
  )
}

function ThrownObject({ projectile, elapsedMs }: { readonly projectile: Projectile; readonly elapsedMs: number }): ReactElement {
  const position = projectilePosition(projectile, elapsedMs)
  const spin = (elapsedMs - projectile.launchedAtMs) / 90
  return (
    <mesh position={position} rotation={[spin, spin * 0.7, 0]} scale={0.28} castShadow raycast={() => null}>
      <primitive object={unitBoxGeometry} attach="geometry" />
      {/* Reflected off the player's armor: it glows the armor's blue on the way back. */}
      <meshStandardMaterial color={projectile.reflected ? '#5CE1E6' : '#7FBF3F'} emissive={projectile.reflected ? '#1C7FD6' : '#2F5F10'} />
    </mesh>
  )
}

function GrenadeBlast({ blast, elapsedMs, radius }: { readonly blast: Blast; readonly elapsedMs: number; readonly radius: number }): ReactElement {
  const [x, , z] = worldPosition(blast.x, blast.depth)
  const { grow, fade } = blastProgress(blast, elapsedMs)
  const size = radius * 2 * (0.2 + 0.8 * grow)
  return (
    <mesh position={[x, 0.4, z]} scale={size} raycast={() => null}>
      <primitive object={unitSphereGeometry} attach="geometry" />
      <meshBasicMaterial color="#FF9F1C" transparent opacity={0.75 * fade} depthWrite={false} />
    </mesh>
  )
}

const PIERCE_SHARD_ANGLES = [0.3, 1.35, 2.4, 3.45, 4.5, 5.55] as const

function glowMaterial(color: string, opacity: number): ReactElement {
  return <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
}

/** Where a right hit landed: a spark (standard rounds), a streak through the zombie (armor-piercing), or a fireball (explosive). */
function HitEffect({ impact, specialStyle, elapsedMs }: { readonly impact: Impact; readonly specialStyle: ImpactStyle; readonly elapsedMs: number }): ReactElement | null {
  const style = impactStyleFor(impact, specialStyle)
  const progress = impactProgress(impact, style, elapsedMs)
  if (progress === null) return null
  const { grow, fade } = progress
  const position = impactPosition(impact)
  switch (style) {
    case 'spark':
      return (
        <mesh name="impact-spark" position={position} scale={0.15 + 0.35 * grow} raycast={() => null}>
          <primitive object={unitSphereGeometry} attach="geometry" />
          {glowMaterial('#FFE066', 0.9 * fade)}
        </mesh>
      )
    case 'pierce': {
      // Punches through: a ring where it went in, and shards bursting out the back.
      const length = 0.2 + 0.9 * grow
      return (
        <group name="impact-pierce" position={position}>
          {PIERCE_SHARD_ANGLES.map((angle) => (
            <mesh key={angle} position={[Math.cos(angle) * (0.15 + length / 2), Math.sin(angle) * (0.15 + length / 2), -0.3]} rotation={[0, 0, angle]} scale={[length, 0.05, 0.05]} raycast={() => null}>
              <primitive object={unitBoxGeometry} attach="geometry" />
              {glowMaterial('#7DF9FF', fade)}
            </mesh>
          ))}
          <mesh scale={0.4 + 0.9 * grow} raycast={() => null}>
            <primitive object={unitTorusGeometry} attach="geometry" />
            {glowMaterial('#22D3EE', 0.8 * fade)}
          </mesh>
        </group>
      )
    }
    case 'explosion':
      return (
        <group name="impact-explosion" position={position}>
          <mesh scale={0.4 + 1.5 * grow} raycast={() => null}>
            <primitive object={unitSphereGeometry} attach="geometry" />
            {glowMaterial('#FF6A00', 0.8 * fade)}
          </mesh>
          <mesh scale={0.3 + 0.8 * grow} raycast={() => null}>
            <primitive object={unitSphereGeometry} attach="geometry" />
            {glowMaterial('#FFF3A3', fade * fade)}
          </mesh>
          <mesh position={[0, 0.5 * grow, 0]} scale={0.5 + 1.1 * grow} raycast={() => null}>
            <primitive object={unitSphereGeometry} attach="geometry" />
            <meshBasicMaterial color="#3F3F46" transparent opacity={0.4 * fade * grow} depthWrite={false} />
          </mesh>
          {/* A shockwave across the floor. */}
          <mesh position={[0, 0.05 - position[1], 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.5 + 3 * grow, 0.5 + 3 * grow, 0.3]} raycast={() => null}>
            <primitive object={unitTorusGeometry} attach="geometry" />
            {glowMaterial('#FF9F1C', 0.7 * fade)}
          </mesh>
        </group>
      )
    default:
      return assertNeverStyle(style)
  }
}

function assertNeverStyle(style: never): never {
  throw new Error(`unknown impact style: ${String(style)}`)
}

const COLLIDER_PREFIX = 'collider-'

/** The id of the nearest cover collider along the shot, from its mesh name. */
function blockingCoverId(intersections: readonly THREE.Intersection[]): string | null {
  let nearest: THREE.Intersection | null = null
  for (const hit of intersections) {
    if (hit.object.name.startsWith(COLLIDER_PREFIX) && (nearest === null || hit.distance < nearest.distance)) nearest = hit
  }
  return nearest === null ? null : nearest.object.name.slice(COLLIDER_PREFIX.length)
}

export function HordeScene({
  zombies,
  answers,
  characters,
  projectiles,
  blasts,
  impacts,
  impactStyle,
  elapsedMs,
  cover,
  shadows,
  weapon,
  armTint,
  weaponPhase,
  cockingUntilMs,
  cockingMs,
  recoilSignal,
  aimNdc,
  reducedMotion,
  grenadeArmed,
  onShot,
  onGrenade,
  onReloadStart,
  onZombieReady,
}: HordeSceneProps): ReactElement {
  const aspectRatio = useThree((state) => state.size.width / Math.max(1, state.size.height))
  const floor = useMemo(() => ({ plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point: new THREE.Vector3() }), [])

  function handlePointerDown(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation()
    if (grenadeArmed) {
      const hit = event.ray.intersectPlane(floor.plane, floor.point)
      if (hit !== null) onGrenade(fieldPoint(hit.x, hit.z))
      return
    }
    const outcome = resolveRaycastOutcome(classifyHordeIntersections(event.intersections))
    onShot(outcome.type === 'zombie' ? outcome.meta : null, outcome.type === 'blocked' ? blockingCoverId(event.intersections) : null)
  }

  return (
    <>
      <PerspectiveCamera makeDefault position={CAMERA_POSITION} rotation={[-0.14, 0, 0]} fov={aspectRatio < 1 ? 72 : 56} near={0.1} far={60} />

      <group onPointerDown={handlePointerDown}>
        <HordeEnvironment cover={cover} shadows={shadows} />
        {zombies.map((zombie, i) =>
          isDrawn(zombie) ? <ZombieInstance key={zombie.id} zombie={zombie} answer={answers[i] ?? null} character={characters[zombie.slot] ?? SCIENTIST_ZOMBIE} onReady={onZombieReady} /> : null,
        )}
      </group>

      {projectiles.map((projectile) => (
        <ThrownObject key={projectile.id} projectile={projectile} elapsedMs={elapsedMs} />
      ))}
      {blasts.map((blast) => (
        <GrenadeBlast key={blast.id} blast={blast} elapsedMs={elapsedMs} radius={GRENADE.radius} />
      ))}
      {impacts.map((impact) => (
        <HitEffect key={impact.id} impact={impact} specialStyle={impactStyle} elapsedMs={elapsedMs} />
      ))}

      <EquationBlaster
        weapon={weapon}
        armTint={armTint}
        weaponPhase={weaponPhase}
        cockingUntilMs={cockingUntilMs}
        elapsedMs={elapsedMs}
        cockingMs={cockingMs}
        recoilSignal={recoilSignal}
        aimNdc={aimNdc}
        reducedMotion={reducedMotion}
        onReloadStart={onReloadStart}
      />
    </>
  )
}
