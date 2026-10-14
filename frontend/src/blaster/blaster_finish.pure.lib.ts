import type { Vec3Tuple } from './blaster_config.pure.lib.ts'

/**
 * How each blaster looks: a tint over the shared blaster model, extra parts
 * bolted on, and its muzzle flash's colour and size. The better the weapon,
 * the louder the look, so a kid can see what they bought.
 *
 * Parts are in the blaster model's own unscaled space (see the asset audit in
 * blaster_config.pure.lib.ts): local -X is the muzzle end, +X the stock, +Y
 * up, and the body spans [-0.5,0.5] x [-0.195,0.193] x [-0.081,0.082]. The
 * barrel's centreline is at y = 0.065.
 */

export type BlasterFinish = 'classic' | 'rapid' | 'mega'

export type FinishPart =
  | { readonly shape: 'box'; readonly position: Vec3Tuple; readonly size: Vec3Tuple; readonly color: string; readonly glow: boolean }
  /** A ring around the barrel (the X axis). */
  | { readonly shape: 'ring'; readonly position: Vec3Tuple; readonly radius: number; readonly tube: number; readonly color: string; readonly glow: boolean }
  | { readonly shape: 'sphere'; readonly position: Vec3Tuple; readonly radius: number; readonly color: string; readonly glow: boolean }
  /** A tube along the barrel (the X axis). */
  | { readonly shape: 'tube'; readonly position: Vec3Tuple; readonly radius: number; readonly length: number; readonly color: string; readonly glow: boolean }

export interface FinishLook {
  /** Mixed into the model's own colours and glowed in, or null to leave the model as it is. */
  readonly tint: { readonly color: string; readonly amount: number; readonly glow: number } | null
  readonly parts: readonly FinishPart[]
  /** How brightly glowing parts shine, and how much they pulse (0 = steady). */
  readonly glowIntensity: number
  readonly glowPulse: number
  /** Multiplies the muzzle flash sprites and light. White leaves the flash its own warm colours. */
  readonly flashColor: string
  readonly flashScale: number
}

const CLASSIC: FinishLook = { tint: null, parts: [], glowIntensity: 0, glowPulse: 0, flashColor: '#FFFFFF', flashScale: 1 }

const RAPID_CYAN = '#22D3EE'

const RAPID: FinishLook = {
  tint: { color: '#0E7490', amount: 0.35, glow: 0.15 },
  parts: [
    // Twin glowing rails along the top.
    { shape: 'box', position: [-0.12, 0.2, 0.045], size: [0.62, 0.022, 0.018], color: RAPID_CYAN, glow: true },
    { shape: 'box', position: [-0.12, 0.2, -0.045], size: [0.62, 0.022, 0.018], color: RAPID_CYAN, glow: true },
    // A scope with a glowing lens.
    { shape: 'tube', position: [0.06, 0.255, 0], radius: 0.035, length: 0.2, color: '#1F2937', glow: false },
    { shape: 'sphere', position: [-0.045, 0.255, 0], radius: 0.03, color: RAPID_CYAN, glow: true },
    // A collar at the muzzle.
    { shape: 'ring', position: [-0.43, 0.065, 0], radius: 0.085, tube: 0.014, color: RAPID_CYAN, glow: true },
  ],
  glowIntensity: 1.6,
  glowPulse: 0.25,
  flashColor: '#8BF3FF',
  flashScale: 1.2,
}

const MEGA_PINK = '#F472F6'
const MEGA_GOLD = '#FACC15'

const MEGA: FinishLook = {
  tint: { color: '#C026D3', amount: 0.3, glow: 0.2 },
  parts: [
    // Three energy rings stacked down the barrel.
    { shape: 'ring', position: [-0.45, 0.065, 0], radius: 0.1, tube: 0.016, color: MEGA_PINK, glow: true },
    { shape: 'ring', position: [-0.37, 0.065, 0], radius: 0.092, tube: 0.014, color: MEGA_PINK, glow: true },
    { shape: 'ring', position: [-0.29, 0.065, 0], radius: 0.084, tube: 0.012, color: MEGA_PINK, glow: true },
    // A glowing gold strip along the top, with a slim gold fin behind it.
    { shape: 'box', position: [-0.12, 0.16, 0], size: [0.5, 0.022, 0.03], color: MEGA_GOLD, glow: true },
    { shape: 'box', position: [0.1, 0.2, 0], size: [0.24, 0.06, 0.014], color: MEGA_GOLD, glow: false },
    // Small glowing power cells on both sides.
    { shape: 'sphere', position: [0.14, 0.02, 0.085], radius: 0.032, color: MEGA_GOLD, glow: true },
    { shape: 'sphere', position: [0.14, 0.02, -0.085], radius: 0.032, color: MEGA_GOLD, glow: true },
    // Vents along each side.
    { shape: 'box', position: [-0.1, -0.03, 0.086], size: [0.26, 0.022, 0.01], color: MEGA_PINK, glow: true },
    { shape: 'box', position: [-0.1, -0.03, -0.086], size: [0.26, 0.022, 0.01], color: MEGA_PINK, glow: true },
  ],
  glowIntensity: 2.2,
  glowPulse: 0.45,
  flashColor: '#FF9CF9',
  flashScale: 1.7,
}

export const FINISH_LOOKS: Readonly<Record<BlasterFinish, FinishLook>> = { classic: CLASSIC, rapid: RAPID, mega: MEGA }

/** The glow multiplier at `seconds`: a slow breathing pulse around 1. */
export function glowAt(look: FinishLook, seconds: number): number {
  return look.glowIntensity * (1 + look.glowPulse * Math.sin(seconds * 4))
}

/** A badge a kid designed (Zombie Horde's emblem): a round picture with a ring in its colour, on the arm, the blaster, or both. */
export interface WornEmblem {
  /** Loaded as a texture: the kid's art, or a drawn symbol as a data URL. */
  readonly imageUrl: string
  readonly ringColor: string
  readonly onArm: boolean
  readonly onBlaster: boolean
}

/** One face an emblem is stuck on: where its centre is, and how it's turned (a disc faces +Z unturned). */
export interface EmblemFace {
  readonly position: Vec3Tuple
  readonly rotation: Vec3Tuple
}

/** Where an emblem sits, in the model's own unscaled space (see the asset audit in blaster_config.pure.lib.ts): one or more faces, all the same size. */
export interface EmblemSpot {
  readonly faces: readonly EmblemFace[]
  readonly radius: number
}

/**
 * On the blaster's side that faces the first-person camera (+Z, behind the
 * grip), tilted toward the camera so it reads face-on. The tilt is the
 * camera's direction in the model's space under DEFAULT_WEAPON_VIEW's
 * rotation: (0.73, 0.15, 0.67).
 */
export const BLASTER_EMBLEM_SPOT: EmblemSpot = { faces: [{ position: [0.32, -0.02, 0.1], rotation: [-0.214, 0.82, 0.093] }], radius: 0.06 }

/**
 * On the support (left) forearm's side that faces the camera (+Z), tilted
 * the same way: the camera's direction in the arm's space
 * is (-0.27, -0.22, 0.94).
 */
export const ARM_EMBLEM_SPOT: EmblemSpot = { faces: [{ position: [0.02, 0.12, 0.17], rotation: [0.228, -0.268, 0.031] }], radius: 0.11 }
