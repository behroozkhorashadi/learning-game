/**
 * Typed weapon-definition abstraction. Only one weapon exists today
 * (`starter_blaster`), but the shape anticipates a future unlockable
 * weapon catalog without the pure engine ever knowing about it: the engine
 * only ever receives a plain numeric `shotCooldownMs` via `WaveConfig` (see
 * `zombieWaveEngine.ts`) — it does not import this module, and must not.
 * The React layer is responsible for reading the selected weapon's cooldown
 * out of its definition and handing the engine just that number.
 */

export interface WeaponSoundHooks {
  fire?: string
  reload?: string
  empty?: string
}

export interface WeaponDefinition {
  id: string
  displayName: string
  /** Identifies which visual component/procedural renderer draws this
   * weapon — not a literal component reference, so this stays serializable
   * for a future backend-driven inventory response. */
  rendererId: string
  shotCooldownMs: number
  /** 0-1 relative strength, consumed by the viewmodel's recoil animation. */
  recoilStrength: number
  recoilDurationMs: number
  muzzleFlashStyle: string
  /** e.g. 'hitscan_flash' — this game never needs travelling projectiles,
   * but the field exists so a future weapon could ask for one. */
  projectileStyle: string
  soundEffects: WeaponSoundHooks
  crosshairStyle: string
  unlockCost: number
  unlockedByDefault: boolean
}

export const STARTER_BLASTER: WeaponDefinition = {
  id: 'starter_blaster',
  displayName: 'Starter Blaster',
  rendererId: 'procedural_blaster_v1',
  shotCooldownMs: 550,
  recoilStrength: 0.4,
  recoilDurationMs: 150,
  muzzleFlashStyle: 'soft_burst',
  projectileStyle: 'hitscan_flash',
  soundEffects: {},
  crosshairStyle: 'ring_cross',
  unlockCost: 0,
  unlockedByDefault: true,
}

export const WEAPON_DEFINITIONS: Record<string, WeaponDefinition> = {
  [STARTER_BLASTER.id]: STARTER_BLASTER,
}

export const DEFAULT_WEAPON_ID = STARTER_BLASTER.id
