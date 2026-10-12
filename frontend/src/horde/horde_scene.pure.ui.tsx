import { PerspectiveCamera } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState, type ReactElement } from 'react'
import * as THREE from 'three'
import { walkPhaseFor } from '@app/arena/outbreak_scene_rules.pure.lib.ts'
import { resolveRaycastOutcome } from '@app/arena/raycast_outcome.pure.lib.ts'
import { EquationBlaster } from '@app/blaster/equation_blaster.pure.ui.tsx'
import type { WeaponDefinition } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { unitBoxGeometry, unitSphereGeometry } from '@app/science_fair/shared_geometry.pure.lib.ts'
import { SCIENTIST_ZOMBIE, type CharacterDefinition } from '@app/zombies/character_definitions.pure.lib.ts'
import { ZombieCharacter3D } from '@app/zombies/zombie_character_3d.pure.ui.tsx'
import type { WeaponPhase } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import { GRENADE } from './horde_armory.pure.lib.ts'
import { isTargetable, type Blast, type HordeZombie, type Projectile } from './horde_engine.pure.lib.ts'
import { HordeEnvironment } from './horde_environment.pure.ui.tsx'
import { CAMERA_POSITION, fieldPoint, worldPosition, type Cover } from './horde_field.pure.lib.ts'
import { classifyHordeIntersections, type HordeHitMeta } from './horde_raycast.pure.lib.ts'
import { blastProgress, clipRoleFor, healthFraction, isDrawn, projectilePosition, slotColor } from './horde_scene_rules.pure.lib.ts'
import { HordeZombieLabel } from './horde_zombie_label.pure.ui.tsx'
import { useHordeZombieTarget } from './use_horde_zombie_target.pure.hook.ts'

/**
 * Zombie Horde's 3D view: a fixed camera over a wide field, cover, the roaming
 * zombies with their answers and health, thrown objects, grenade blasts, and
 * the first-person blaster. It renders engine state and reports shots; it
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
  readonly elapsedMs: number
  readonly cover: readonly Cover[]
  readonly shadows: boolean
  readonly weapon: WeaponDefinition
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
      <meshStandardMaterial color="#7FBF3F" emissive="#2F5F10" />
    </mesh>
  )
}

function GrenadeBlast({ blast, elapsedMs, radius }: { readonly blast: Blast; readonly elapsedMs: number; readonly radius: number }): ReactElement {
  const [x, , z] = worldPosition(blast.x, blast.depth)
  const { grow, fade } = blastProgress(blast, elapsedMs)
  const size = (blast.dud ? 0.8 : radius * 2) * (0.2 + 0.8 * grow)
  return (
    <mesh position={[x, 0.4, z]} scale={size} raycast={() => null}>
      <primitive object={unitSphereGeometry} attach="geometry" />
      <meshBasicMaterial color={blast.dud ? '#9CA3AF' : '#FF9F1C'} transparent opacity={0.75 * fade} depthWrite={false} />
    </mesh>
  )
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
  elapsedMs,
  cover,
  shadows,
  weapon,
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
      />
    </>
  )
}
