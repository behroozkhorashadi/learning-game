import { SPAWN_Z, type Vec3 } from './laneNavigation'

/**
 * Hand-placed layout data for the "Outbreak at the Science Fair" set —
 * booths, lockers, and the portal frame. Pure placement data, no rendering:
 * `ScienceFairEnvironment` and its children (`ScienceFairBooth`,
 * `ExperimentPortal`, `EnvironmentProp`) read this to know *where* to draw
 * things; `environmentColliders.ts` reads the same list to know what a shot
 * or a zombie's path must respect. One list, so the visual footprint and
 * the collision footprint can never drift apart.
 *
 * Every prop here is placed using one of two trivially-safe rules relative
 * to the four lane corridors (see `laneNavigation.ts`):
 *
 *  - Beyond `widestCorridorOuterEdgeX()` in X (the side booths, along both
 *    aisles) — clear of every lane at every viewport size, because the
 *    lanes only ever pull *closer together* on narrower viewports, never
 *    wider than the "widest" layout this is measured against.
 *  - Behind `SPAWN_Z` in Z (the lockers and the portal frame) — clear of
 *    every lane's Z range entirely, regardless of X.
 *
 * This is deliberately the simplest of the three navigation strategies the
 * spec allows (static, obstacle-free corridors) rather than per-waypoint
 * routing or live collision avoidance: a shooting-gallery layout where
 * zombies only ever walk straight down their own lane has no scenario a
 * static corridor can't already guarantee clear. `environmentLayout.test.ts`
 * / `environmentColliders.test.ts` prove the guarantee holds for the actual
 * numbers below, rather than just asserting it by convention.
 */

export type PropKind = 'booth' | 'locker' | 'portalFrame' | 'wall'

export type BoothSubject = 'volcano' | 'solar_system' | 'magnets' | 'simple_machines' | 'geometry' | 'plants' | 'electricity'

export interface PropPlacement {
  id: string
  kind: PropKind
  /** World-space center of both the decorative geometry and its collider —
   * kept as one value so they can never disagree about where the prop is. */
  position: Vec3
  /** Decorative-only rotation around Y. Never affects the collider, which
   * stays axis-aligned — see `halfExtents`, authored already accounting for
   * this rotation where it matters (a booth facing inward has its
   * footprint's X/Z swapped in the data, not computed from the angle). */
  rotationY: number
  /** World-aligned collision half-extents (half-width X, half-height Y,
   * half-depth Z), already accounting for `rotationY`. */
  halfExtents: Vec3
  subject?: BoothSubject
}

// Margin added on top of the widest possible corridor edge so a booth's
// visible geometry (which extends a bit beyond its collider) never looks
// like it's grazing a lane even at the narrowest layout, where the gap is
// largest anyway.
const SIDE_AISLE_X = 4.2
const SIDE_AISLE_MIRROR_X = -SIDE_AISLE_X

const LOCKER_Z = SPAWN_Z - 1.5
const PORTAL_Z = SPAWN_Z - 1
const BACK_WALL_Z = SPAWN_Z - 2.5
const SIDE_WALL_X = 6

const BOOTH_HALF_EXTENTS: Vec3 = [0.4, 0.9, 0.6]

const BOOTH_SUBJECTS_LEFT: BoothSubject[] = ['volcano', 'solar_system', 'magnets']
const BOOTH_SUBJECTS_RIGHT: BoothSubject[] = ['simple_machines', 'geometry', 'plants']
const BOOTH_Z_POSITIONS = [-9.5, -6.5, -3.5]

function sideBooths(subjects: BoothSubject[], x: number, facingRotationY: number): PropPlacement[] {
  return subjects.map((subject, i) => ({
    id: `booth-${subject}-${x > 0 ? 'r' : 'l'}`,
    kind: 'booth',
    position: [x, 0, BOOTH_Z_POSITIONS[i]],
    rotationY: facingRotationY,
    halfExtents: BOOTH_HALF_EXTENTS,
    subject,
  }))
}

export const PROP_PLACEMENTS: PropPlacement[] = [
  ...sideBooths(BOOTH_SUBJECTS_LEFT, SIDE_AISLE_MIRROR_X, Math.PI / 2),
  ...sideBooths(BOOTH_SUBJECTS_RIGHT, SIDE_AISLE_X, -Math.PI / 2),

  { id: 'locker-row-left', kind: 'locker', position: [-2.6, 0.6, LOCKER_Z], rotationY: 0, halfExtents: [1.3, 0.6, 0.3] },
  { id: 'locker-row-right', kind: 'locker', position: [2.6, 0.6, LOCKER_Z], rotationY: 0, halfExtents: [1.3, 0.6, 0.3] },

  { id: 'portal-frame', kind: 'portalFrame', position: [0, 1.3, PORTAL_Z], rotationY: 0, halfExtents: [2.0, 1.3, 0.3] },

  { id: 'wall-left', kind: 'wall', position: [-SIDE_WALL_X, 2.5, -6], rotationY: 0, halfExtents: [0.2, 3, 9] },
  { id: 'wall-right', kind: 'wall', position: [SIDE_WALL_X, 2.5, -6], rotationY: 0, halfExtents: [0.2, 3, 9] },
  { id: 'wall-back', kind: 'wall', position: [0, 2.5, BACK_WALL_Z], rotationY: 0, halfExtents: [7, 3, 0.2] },
]

export { SIDE_AISLE_X, LOCKER_Z, PORTAL_Z, BACK_WALL_Z, SIDE_WALL_X }
