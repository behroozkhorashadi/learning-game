/**
 * Zombie Horde's playing field: an open floor in front of a fixed camera,
 * wider at the back than at the front (it's what the camera sees), with
 * fixed cover the zombies walk around and hide behind.
 *
 * Positions are `x` (left/right, 0 is straight ahead) and `depth` (distance
 * from the player's line, 0 at the player). The engine works only in these;
 * `worldPosition` maps them into the 3D scene (the camera looks down -z), so
 * nothing else needs to know the mapping.
 */

/** Where the player's eye (the camera) is, in scene coordinates. */
export const CAMERA_POSITION: readonly [number, number, number] = [0, 1.7, 2.2]

/** Where a new zombie enters, at the back of the field. */
export const SPAWN_DEPTH = 19
/** A zombie this close has reached the player. */
export const CONTACT_DEPTH = 1.4
/** How far a zombie's body reaches from its centre, for walking around cover. */
export const ZOMBIE_RADIUS = 0.45

/** The widest a zombie may stray from the centre line at `depth`: the camera's view narrows toward the player. */
export function maxAbsX(depth: number): number {
  return 1.8 + Math.max(depth, 0) * 0.36
}

export function clampX(x: number, depth: number): number {
  const limit = maxAbsX(depth)
  return Math.min(limit, Math.max(-limit, x))
}

export type CoverKind = 'crates' | 'lockers' | 'table' | 'barrier'

/**
 * One fixed piece of cover: a box on the floor, centred at (`x`, `depth`).
 * Shots that hit it are blocked. A low one (crates, a table) hides a zombie's
 * body but not its head; a tall one (lockers) hides all of it.
 */
export interface Cover {
  readonly id: string
  readonly kind: CoverKind
  readonly x: number
  readonly depth: number
  readonly halfWidth: number
  readonly halfDepth: number
  readonly height: number
}

/**
 * Each piece either reaches the side of the field along its whole length or
 * leaves a gap at least a zombie wide (2 × ZOMBIE_RADIUS) all along: a
 * narrower gap is a corner a zombie can wedge into.
 */
export const COVER: readonly Cover[] = [
  { id: 'crates-near-left', kind: 'crates', x: -3.9, depth: 7, halfWidth: 0.75, halfDepth: 0.6, height: 1.2 },
  { id: 'lockers-near-right', kind: 'lockers', x: 2.95, depth: 9, halfWidth: 1, halfDepth: 0.4, height: 2.3 },
  { id: 'table-middle', kind: 'table', x: 0, depth: 11.5, halfWidth: 1.4, halfDepth: 0.55, height: 1 },
  { id: 'crates-far-left', kind: 'crates', x: -4.8, depth: 14, halfWidth: 0.85, halfDepth: 0.7, height: 1.3 },
  { id: 'lockers-far-right', kind: 'lockers', x: 5.2, depth: 15, halfWidth: 0.9, halfDepth: 0.4, height: 2.3 },
  { id: 'barrier-far-middle', kind: 'barrier', x: -1.4, depth: 16.5, halfWidth: 1.1, halfDepth: 0.4, height: 1.1 },
]

/** The cover whose footprint, grown by `margin` on every side, contains the point, if any. */
export function coverAt(x: number, depth: number, margin: number, cover: readonly Cover[]): Cover | null {
  for (const box of cover) {
    if (Math.abs(x - box.x) <= box.halfWidth + margin && Math.abs(depth - box.depth) <= box.halfDepth + margin) return box
  }
  return null
}

/** The cover a zombie at this spot is standing just behind (from the player's view), if any. */
export function coverInFront(x: number, depth: number, band: number, cover: readonly Cover[]): Cover | null {
  for (const box of cover) {
    const back = box.depth + box.halfDepth
    if (Math.abs(x - box.x) <= box.halfWidth * 0.8 && depth >= back && depth <= back + band) return box
  }
  return null
}

/** The scene position for a field point: the camera looks down -z from just behind the player's line. */
export function worldPosition(x: number, depth: number): readonly [number, number, number] {
  return [x, 0, -depth]
}

/** The field point under a scene position on the floor; the inverse of `worldPosition`. */
export function fieldPoint(worldX: number, worldZ: number): { readonly x: number; readonly depth: number } {
  return { x: worldX, depth: -worldZ }
}
