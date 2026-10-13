import type { BlasterFinish } from './blaster_finish.pure.lib.ts'

/**
 * Typed weapon-definition abstraction: the starter blaster, and the Rapid and
 * Mega blasters Zombie Horde's armory sells (same ids as its catalog). The
 * pure engines never know about it: the engine
 * only ever receives a plain numeric `cockingMs` via `WaveConfig` (see
 * `zombieWaveEngine.ts`) — it does not import this module, and must not.
 * The React layer is responsible for reading the selected weapon's cocking
 * duration out of its definition and handing the engine just that number.
 */

export interface WeaponSoundHooks {
  fire?: string
  reload?: string
  empty?: string
}

export interface WeaponDefinition {
  id: string
  displayName: string
  rendererId: string
  /** How this blaster looks: blaster_finish.pure.lib.ts. */
  finish: BlasterFinish
  /** How long (ms) the weapon takes to cock between the first and second
   * shot of a wave — the sole gate on the second shot now that a wave is
   * exactly two attempts (see `zombieWaveEngine.ts`'s `WeaponPhase`). */
  cockingMs: number
  recoilStrength: number
  recoilDurationMs: number
  muzzleFlashStyle: string
  projectileStyle: string
  soundEffects: WeaponSoundHooks
  crosshairStyle: string
  unlockCost: number
  unlockedByDefault: boolean
}

export const STARTER_BLASTER: WeaponDefinition = {
  id: 'starter_blaster',
  displayName: 'Starter Blaster',
  rendererId: 'equation_blaster_glb_v1',
  finish: 'classic',
  cockingMs: 900,
  recoilStrength: 1,
  // Also doubles as how long the reload's dip/arm-slide waits before
  // starting (see EquationBlaster.tsx's computeVisualCockingProgress) —
  // long enough that the kick is clearly visible and settled before the
  // reload motion begins, short enough to still feel snappy.
  recoilDurationMs: 260,
  muzzleFlashStyle: 'soft_burst',
  projectileStyle: 'hitscan_flash',
  soundEffects: {},
  crosshairStyle: 'ring_cross',
  unlockCost: 0,
  unlockedByDefault: true,
}

export const RAPID_BLASTER: WeaponDefinition = {
  ...STARTER_BLASTER,
  id: 'rapid_blaster',
  displayName: 'Rapid Blaster',
  finish: 'rapid',
  cockingMs: 350,
  recoilDurationMs: 200,
  muzzleFlashStyle: 'cyan_burst',
  unlockCost: 250,
  unlockedByDefault: false,
}

export const MEGA_BLASTER: WeaponDefinition = {
  ...STARTER_BLASTER,
  id: 'mega_blaster',
  displayName: 'Mega Blaster',
  finish: 'mega',
  cockingMs: 200,
  recoilStrength: 1.3,
  recoilDurationMs: 160,
  muzzleFlashStyle: 'mega_burst',
  unlockCost: 600,
  unlockedByDefault: false,
}

export const WEAPON_DEFINITIONS: Record<string, WeaponDefinition> = {
  [STARTER_BLASTER.id]: STARTER_BLASTER,
  [RAPID_BLASTER.id]: RAPID_BLASTER,
  [MEGA_BLASTER.id]: MEGA_BLASTER,
}

export const DEFAULT_WEAPON_ID = STARTER_BLASTER.id

/** The definition for a weapon id; the starter blaster for an id with none. */
export function weaponDefinitionFor(id: string): WeaponDefinition {
  return WEAPON_DEFINITIONS[id] ?? STARTER_BLASTER
}
