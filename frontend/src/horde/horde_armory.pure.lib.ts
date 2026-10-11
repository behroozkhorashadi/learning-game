/**
 * What each armory item does in play. The server owns the catalog's ids,
 * names, and prices (backend app/armory/); this file owns the numbers a round
 * plays with, keyed by the same ids. The engine never sees an item: it gets a
 * plain `ShotPower` and cooldown, worked out here from the chosen loadout.
 *
 * Health is 100. With the starter blaster and standard rounds, a headshot
 * takes 1 hit, a body shot 2, and a leg shot 3 (and knocks the zombie down).
 */

export type ShotZone = 'head' | 'body' | 'leg'

/** Damage per hit zone, out of a zombie's 100 health. */
export type ShotPower = Readonly<Record<ShotZone, number>>

export interface WeaponStats {
  readonly id: string
  /** Every zone's damage is multiplied by this. */
  readonly damageScale: number
  /** How long (ms) after a shot before the next one. */
  readonly cooldownMs: number
}

export interface BulletStats {
  readonly id: string
  readonly power: ShotPower
}

export interface GrenadeStats {
  /** Field units from the blast centre that the blast reaches. */
  readonly radius: number
  readonly damage: number
}

export const ZOMBIE_MAX_HEALTH = 100

const STARTER_WEAPON: WeaponStats = { id: 'starter_blaster', damageScale: 1, cooldownMs: 700 }
const STANDARD_ROUNDS: BulletStats = { id: 'standard_rounds', power: { head: 100, body: 50, leg: 34 } }

export const WEAPONS: readonly WeaponStats[] = [
  STARTER_WEAPON,
  { id: 'rapid_blaster', damageScale: 1.15, cooldownMs: 350 },
  { id: 'mega_blaster', damageScale: 1.35, cooldownMs: 200 },
]

export const BULLETS: readonly BulletStats[] = [
  STANDARD_ROUNDS,
  { id: 'armor_piercing', power: { head: 100, body: 70, leg: 50 } },
  { id: 'explosive_rounds', power: { head: 100, body: 85, leg: 60 } },
]

export const GRENADE: GrenadeStats = { radius: 2.6, damage: 100 }

export interface Loadout {
  readonly weapon: WeaponStats
  readonly bullet: BulletStats
}

export const STARTER_LOADOUT: Loadout = { weapon: STARTER_WEAPON, bullet: STANDARD_ROUNDS }

/** The weapon or bullet with this id, if this file knows it. */
export function weaponById(id: string): WeaponStats | null {
  return WEAPONS.find((weapon) => weapon.id === id) ?? null
}

export function bulletById(id: string): BulletStats | null {
  return BULLETS.find((bullet) => bullet.id === id) ?? null
}

/** The best weapon and bullet among `owned`, in catalog order (later is better). The default pick on the start screen. */
export function bestOwned(owned: readonly string[]): { readonly weaponId: string; readonly bulletId: string } {
  const weapon = [...WEAPONS].reverse().find((w) => owned.includes(w.id)) ?? STARTER_WEAPON
  const bullet = [...BULLETS].reverse().find((b) => owned.includes(b.id)) ?? STANDARD_ROUNDS
  return { weaponId: weapon.id, bulletId: bullet.id }
}

/** The loadout for a chosen weapon and bullet. An id this file doesn't know (or one not owned) falls back to the starter. */
export function loadoutFor(weaponId: string, bulletId: string, owned: readonly string[]): Loadout {
  const weapon = owned.includes(weaponId) ? weaponById(weaponId) : null
  const bullet = owned.includes(bulletId) ? bulletById(bulletId) : null
  return { weapon: weapon ?? STARTER_WEAPON, bullet: bullet ?? STANDARD_ROUNDS }
}

/** What one hit does per zone with this loadout, rounded to whole health points. */
export function shotPower({ weapon, bullet }: Loadout): ShotPower {
  return {
    head: Math.round(bullet.power.head * weapon.damageScale),
    body: Math.round(bullet.power.body * weapon.damageScale),
    leg: Math.round(bullet.power.leg * weapon.damageScale),
  }
}

/** How many hits in `zone` take down a full-health zombie: what the shop shows a kid. */
export function hitsToDefeat(power: ShotPower, zone: ShotZone): number {
  return Math.ceil(ZOMBIE_MAX_HEALTH / Math.max(power[zone], 1))
}
