/**
 * What each armory item does in play. The server owns the catalog's ids,
 * names, and prices (backend app/armory/); this file owns the numbers a round
 * plays with, keyed by the same ids. The engine never sees an item: it gets a
 * plain `ShotPower` and cooldown, worked out here from the chosen loadout.
 *
 * Health is 100. With the starter blaster and standard rounds, a zombie takes
 * 2 headshots, 4 body shots, or 5 leg shots (each of which knocks it down).
 * Upgrades bring the body and leg counts down. Only the top pair, the Mega
 * Blaster with Explosive Rounds, defeats a zombie with one headshot: buying
 * both has to be worth it, since a round lands one hit per question.
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

/** How a hit looks where it lands. */
export type ImpactStyle = 'spark' | 'pierce' | 'explosion'

export interface BulletStats {
  readonly id: string
  readonly power: ShotPower
  readonly impact: ImpactStyle
}

export interface GrenadeStats {
  /** Field units from the blast centre that the blast reaches. */
  readonly radius: number
  readonly damage: number
}

export const ZOMBIE_MAX_HEALTH = 100

const STARTER_WEAPON: WeaponStats = { id: 'starter_blaster', damageScale: 1, cooldownMs: 700 }
const STANDARD_ROUNDS: BulletStats = { id: 'standard_rounds', power: { head: 50, body: 25, leg: 20 }, impact: 'spark' }

export const WEAPONS: readonly WeaponStats[] = [
  STARTER_WEAPON,
  { id: 'rapid_blaster', damageScale: 1.15, cooldownMs: 350 },
  { id: 'mega_blaster', damageScale: 1.35, cooldownMs: 200 },
]

export const BULLETS: readonly BulletStats[] = [
  STANDARD_ROUNDS,
  { id: 'armor_piercing', power: { head: 50, body: 35, leg: 25 }, impact: 'pierce' },
  { id: 'explosive_rounds', power: { head: 75, body: 45, leg: 35 }, impact: 'explosion' },
]

export const GRENADE: GrenadeStats = { radius: 2.6, damage: 100 }

/**
 * What one armor gem charge does: bounces a thrown thing back at its thrower
 * (`reflect`); makes a zombie that reaches the player cost half a heart
 * instead of a whole one and flings it back (`block`); either, whichever comes
 * first (`mega`); or wins back half a heart after a streak of right answers
 * (`heal`).
 */
export type GemKind = 'reflect' | 'block' | 'mega' | 'heal'

/** Gem charges worn into a round, by kind. Charges of the same kind stack. */
export type Armor = Readonly<Record<GemKind, number>>

export const NO_ARMOR: Armor = { reflect: 0, block: 0, mega: 0, heal: 0 }

export interface GemStats {
  readonly id: string
  readonly kind: GemKind
}

export const GEMS: readonly GemStats[] = [
  { id: 'reflect_gem', kind: 'reflect' },
  { id: 'block_gem', kind: 'block' },
  { id: 'mega_gem', kind: 'mega' },
  { id: 'heal_gem', kind: 'heal' },
]

export function gemById(id: string): GemStats | null {
  return GEMS.find((gem) => gem.id === id) ?? null
}

/** The armor for a round from the gem charges owned, by gem item id. Ids this file doesn't know are left out. */
export function armorFrom(charges: Readonly<Record<string, number>>): Armor {
  return GEMS.reduce<Armor>((armor, gem) => ({ ...armor, [gem.kind]: armor[gem.kind] + Math.max(charges[gem.id] ?? 0, 0) }), NO_ARMOR)
}

/** Thorns Plating, an armor upgrade bought once: every blocked zombie takes this much damage too (never enough to defeat it). */
export const THORNS_PLATING_ID = 'thorns_plating'
export const THORNS_DAMAGE = 25

/** What a round wears: the gem charges owned, and the thorns' damage (0 without Thorns Plating). */
export interface RoundArmor {
  readonly charges: Armor
  readonly thornsDamage: number
}

export const NO_ROUND_ARMOR: RoundArmor = { charges: NO_ARMOR, thornsDamage: 0 }

/** The armor for a round from what the armory says is owned: gem charges by item id, and the upgrades owned. */
export function roundArmorFrom(charges: Readonly<Record<string, number>>, owned: readonly string[]): RoundArmor {
  return { charges: armorFrom(charges), thornsDamage: owned.includes(THORNS_PLATING_ID) ? THORNS_DAMAGE : 0 }
}

/** How a skin tints the first-person arms: the same shape as a blaster finish's tint. */
export interface ArmTint {
  readonly color: string
  readonly amount: number
  readonly glow: number
}

/** An armor skin: looks only. It tints the arms, and colours the flash when a gem goes off. */
export interface SkinStats {
  readonly id: string
  /** Null leaves the arms as modelled. */
  readonly tint: ArmTint | null
  readonly color: string
}

export const STEEL_SUIT: SkinStats = { id: 'steel_suit', tint: null, color: '#5CA8E6' }

export const SKINS: readonly SkinStats[] = [
  STEEL_SUIT,
  { id: 'jungle_camo', tint: { color: '#3F7A22', amount: 0.55, glow: 0 }, color: '#5BCC2D' },
  { id: 'galaxy_suit', tint: { color: '#5B3FD6', amount: 0.55, glow: 0.35 }, color: '#9D57FA' },
  { id: 'gold_suit', tint: { color: '#D4A017', amount: 0.6, glow: 0.3 }, color: '#FFB020' },
]

export function skinById(id: string): SkinStats | null {
  return SKINS.find((skin) => skin.id === id) ?? null
}

/** The skin worn: the chosen one if it's owned, else the fanciest owned (later in the catalog), else steel. */
export function skinFor(chosenId: string | null, owned: readonly string[]): SkinStats {
  const chosen = chosenId !== null && owned.includes(chosenId) ? skinById(chosenId) : null
  return chosen ?? [...SKINS].reverse().find((skin) => owned.includes(skin.id)) ?? STEEL_SUIT
}

/** The charges a round used, by gem item id, for banking it; kinds it didn't use are left out. */
export function gemsUsedByItem(used: Armor): Readonly<Record<string, number>> {
  return Object.fromEntries(GEMS.flatMap((gem) => (used[gem.kind] > 0 ? [[gem.id, used[gem.kind]]] : [])))
}

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
