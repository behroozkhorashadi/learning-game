/**
 * Typed weapon-definition abstraction. Only one weapon exists today
 * (`starter_blaster`), but the shape anticipates a future unlockable
 * weapon catalog without the pure engine ever knowing about it: the engine
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
  cockingMs: 900,
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
