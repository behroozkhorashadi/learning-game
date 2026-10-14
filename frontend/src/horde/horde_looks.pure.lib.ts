import type { ArmoryLooksRecord, ArmoryLooksStateRecord, EmblemPlace, EmblemSymbol, SuitShine } from '@app/api/armory_schema.pure.lib.ts'
import { skinFor, type ArmTint } from './horde_armory.pure.lib.ts'

/**
 * What a kid's saved looks (backend `ArmoryLooks`) put on screen: the arms'
 * tint, the colour the gems flash in, the blaster's paint, the emblem, and
 * the art on the Zombie Horde billboard. The server checks every look is
 * unlocked before saving it; this file only turns it into colours and images.
 */

export const DEFAULT_LOOKS: ArmoryLooksRecord = { skin_id: null, suit_paint: null, blaster_color: null, emblem: null, hung: { pathfinder: null, horde: null } }

/** The style unlocks, by what they open (the server's catalog ids, backend armory_reducers_pure). */
export const STYLE_UNLOCKS = {
  suitPaint: 'suit_paint',
  blasterPaint: 'blaster_paint',
  emblem: 'emblem_maker',
  pathfinder: 'pathfinder_frame',
  horde: 'horde_billboard',
} as const

export type StyleUnlock = keyof typeof STYLE_UNLOCKS

export const EMBLEM_EMOJI: Readonly<Record<EmblemSymbol, string>> = {
  star: '⭐',
  bolt: '⚡',
  heart: '❤️',
  crown: '👑',
  flame: '🔥',
  rocket: '🚀',
  paw: '🐾',
  smile: '😄',
  moon: '🌙',
  rainbow: '🌈',
  dino: '🦖',
  zombie: '🧟',
}

export const SHINE_LABELS: Readonly<Record<SuitShine, string>> = { matte: 'Matte', shiny: 'Shiny', glow: 'Glowing' }
export const PLACE_LABELS: Readonly<Record<EmblemPlace, string>> = { arm: 'On my arm', blaster: 'On my blaster', both: 'On both' }

/** How strongly each shine mixes the paint in, and how much it glows. */
const SHINE_TINT: Readonly<Record<SuitShine, { readonly amount: number; readonly glow: number }>> = {
  matte: { amount: 0.75, glow: 0 },
  shiny: { amount: 0.6, glow: 0.18 },
  glow: { amount: 0.55, glow: 0.6 },
}

/** Blaster paint covers most of the finish's own colour, with a little glow so it reads in the dim arena. */
const BLASTER_PAINT = { amount: 0.7, glow: 0.12 } as const

/** A badge to stick on the arm or the blaster: a round picture with a ring in its colour. */
export interface EmblemLook {
  /** A URL the 3D view loads as a texture: the kid's art, or a drawn symbol. */
  readonly imageUrl: string
  readonly ringColor: string
  readonly onArm: boolean
  readonly onBlaster: boolean
}

export interface GearLook {
  /** The skin item worn (the shop marks it Wearing). */
  readonly skinId: string
  readonly armTint: ArmTint | null
  /** The armor's colour: what the gems flash in. */
  readonly armorColor: string
  /** The blaster's paint, or null to keep its own finish. */
  readonly blasterTint: ArmTint | null
  readonly emblem: EmblemLook | null
  /** The art on the Zombie Horde billboard, or null for no billboard. */
  readonly billboardUrl: string | null
}

/** A drawn symbol emblem, as an SVG data URL: the emoji on a disc of the emblem's colour. */
export function symbolEmblemUrl(symbol: EmblemSymbol, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><circle cx="64" cy="64" r="64" fill="${color}"/><text x="64" y="68" font-size="76" text-anchor="middle" dominant-baseline="middle">${EMBLEM_EMOJI[symbol]}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** The picture an emblem shows, or null when its art isn't in `pictures` (gone from the gallery). */
export function emblemImageUrl(emblem: NonNullable<ArmoryLooksRecord['emblem']>, pictures: Readonly<Record<string, string>>): string | null {
  if (emblem.symbol !== null) return symbolEmblemUrl(emblem.symbol, emblem.color)
  return emblem.art_id === null ? null : (pictures[emblem.art_id] ?? null)
}

/** What the saved looks put on screen. `owned` decides the skin (a skin not owned falls back, as `skinFor` does). */
export function gearLookFor(state: ArmoryLooksStateRecord, owned: readonly string[]): GearLook {
  const { looks, pictures } = state
  const skin = skinFor(looks.skin_id, owned)
  const paint = looks.suit_paint
  const emblemUrl = looks.emblem === null ? null : emblemImageUrl(looks.emblem, pictures)
  return {
    skinId: skin.id,
    armTint: paint === null ? skin.tint : { color: paint.color, ...SHINE_TINT[paint.shine] },
    armorColor: paint === null ? skin.color : paint.color,
    blasterTint: looks.blaster_color === null ? null : { color: looks.blaster_color, ...BLASTER_PAINT },
    emblem: looks.emblem === null || emblemUrl === null ? null : { imageUrl: emblemUrl, ringColor: looks.emblem.color, onArm: looks.emblem.place !== 'blaster', onBlaster: looks.emblem.place !== 'arm' },
    billboardUrl: looks.hung.horde === null ? null : (pictures[looks.hung.horde] ?? null),
  }
}

/** Whether `unlock` is owned. */
export function isUnlocked(unlock: StyleUnlock, owned: readonly string[]): boolean {
  return owned.includes(STYLE_UNLOCKS[unlock])
}
