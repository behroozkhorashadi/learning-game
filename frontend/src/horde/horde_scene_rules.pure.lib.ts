import type { ZombieClipRole } from '@app/zombies/zombie_animation_fallback.pure.lib.ts'
import { ZOMBIE_MAX_HEALTH, type ImpactStyle, type ShotZone } from './horde_armory.pure.lib.ts'
import { BLAST_MS, IMPACT_MS, type Blast, type HordeZombie, type Impact, type Projectile } from './horde_engine.pure.lib.ts'
import { worldPosition } from './horde_field.pure.lib.ts'

/** The scene's pure rules (horde_scene.pure.ui.tsx renders them). */

export const SLOT_COLORS = ['#9D57FA', '#144FFF', '#5BCC2D', '#F59E0B'] as const

export function slotColor(slot: number): string {
  return SLOT_COLORS[slot % SLOT_COLORS.length] ?? SLOT_COLORS[0]
}

/** Which animation a zombie plays in each posture. */
export function clipRoleFor(zombie: HordeZombie): ZombieClipRole {
  switch (zombie.posture) {
    case 'advancing':
      return 'walk'
    case 'hiding':
      return 'idle'
    case 'staggered':
      return 'hitReact'
    case 'dodging':
      return 'dodge'
    case 'throwing':
    case 'attacking':
      return 'reach'
    case 'downed':
      return 'knockedDown'
    case 'rising':
      return 'getUp'
    case 'dead':
    case 'gone':
      return zombie.defeatedBy === 'head' ? 'deadHeadshot' : 'deadBody'
    default:
      return assertNever(zombie.posture)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected posture: ${String(value)}`)
}

/** A zombie that has left (after attacking) isn't drawn; a defeated one stays for its death animation. */
export function isDrawn(zombie: HordeZombie): boolean {
  return zombie.posture !== 'gone'
}

export function healthFraction(zombie: HordeZombie): number {
  return Math.max(0, Math.min(1, zombie.health / ZOMBIE_MAX_HEALTH))
}

type Vec3 = readonly [number, number, number]

/**
 * Head, body, or leg for a hit at `point`, measured along the zombie's own
 * body rather than by height, so it holds whether the zombie is standing,
 * staggering, or lying on the floor: 0 at the head bone, 1 at the hips bone.
 * Above (before) the head bone is the head; well past the hips is a leg. The
 * waist and shorts still count as body, so aiming at the middle of a zombie
 * is a body shot, not a knockdown.
 */
export function zoneAlongBody(point: Vec3, head: Vec3, hips: Vec3): ShotZone {
  const ax = hips[0] - head[0]
  const ay = hips[1] - head[1]
  const az = hips[2] - head[2]
  const lengthSq = ax * ax + ay * ay + az * az
  if (lengthSq < 1e-6) return 'body'
  const t = ((point[0] - head[0]) * ax + (point[1] - head[1]) * ay + (point[2] - head[2]) * az) / lengthSq
  if (t <= 0.05) return 'head'
  if (t >= 1.3) return 'leg'
  return 'body'
}

/** Thrown objects fly toward a point just in front of the camera. */
const THROW_TARGET: Vec3 = [0.25, 1.35, 1.3]
const THROW_HEIGHT = 1.6
const THROW_ARC = 2.2

/** A thrown object's position at `nowMs`: a lob from the thrower's hand to just in front of the camera, or (reflected off the player's armor) the same lob back. */
export function projectilePosition(projectile: Projectile, nowMs: number): Vec3 {
  const span = Math.max(projectile.landsAtMs - projectile.launchedAtMs, 1)
  const flown = Math.min(Math.max((nowMs - projectile.launchedAtMs) / span, 0), 1)
  const t = projectile.reflected ? 1 - flown : flown
  const [fx, , fz] = worldPosition(projectile.fromX, projectile.fromDepth)
  return [fx + (THROW_TARGET[0] - fx) * t, THROW_HEIGHT + (THROW_TARGET[1] - THROW_HEIGHT) * t + THROW_ARC * 4 * t * (1 - t), fz + (THROW_TARGET[2] - fz) * t]
}

/** A blast's growth (0..1) and fade (1..0) at `nowMs`. */
export function blastProgress(blast: Blast, nowMs: number): { readonly grow: number; readonly fade: number } {
  const t = Math.min(Math.max((nowMs - blast.atMs) / BLAST_MS, 0), 1)
  return { grow: 1 - (1 - t) * (1 - t), fade: 1 - t }
}

/** How long each kind of hit effect lasts: the bigger the bang, the longer. Never longer than the engine keeps an impact. */
export const IMPACT_STYLE_MS: Readonly<Record<ImpactStyle, number>> = { spark: 260, pierce: 380, explosion: IMPACT_MS }

/** Roughly where on a standing zombie each zone is, in world units above the floor. */
const ZONE_HEIGHT: Readonly<Record<ShotZone, number>> = { head: 1.75, body: 1.2, leg: 0.5 }

/** How a hit looks: special rounds in the loadout's own style, standard rounds (and special ones run out) as a spark. */
export function impactStyleFor(impact: Impact, specialStyle: ImpactStyle): ImpactStyle {
  return impact.special ? specialStyle : 'spark'
}

/** Where a hit effect sits: on the zombie, at the height of the zone it hit. */
export function impactPosition(impact: Impact): Vec3 {
  const [x, , z] = worldPosition(impact.x, impact.depth)
  return [x, ZONE_HEIGHT[impact.zone], z]
}

/** A hit effect's growth (0..1, fast at first) and fade (1..0) at `nowMs`, or null once it's over. */
export function impactProgress(impact: Impact, style: ImpactStyle, nowMs: number): { readonly grow: number; readonly fade: number } | null {
  const t = (nowMs - impact.atMs) / IMPACT_STYLE_MS[style]
  if (t < 0 || t >= 1) return null
  return { grow: 1 - (1 - t) * (1 - t) * (1 - t), fade: 1 - t }
}

/** Seconds left on the clock, rounded up, for the HUD. */
export function secondsLeft(elapsedMs: number, durationMs: number): number {
  return Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000))
}
