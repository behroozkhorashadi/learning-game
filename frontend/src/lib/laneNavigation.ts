/**
 * Pure lane/path data for Equation Outbreak's four approach lanes — the
 * geometric complement to `zombieWaveEngine`'s normalized 0..1 `distance`.
 * The engine owns *how far* a carrier has progressed; this module owns
 * *where that progress sits in 3D space* for a given lane, and what counts
 * as "still inside the lane." No Three.js/React import here, and no
 * decorative content — the renderer (`EquationOutbreakScene`,
 * `ScienceFairEnvironment`, and friends) reads this data; it never invents
 * its own lane geometry.
 *
 * A lane's `waypoints` is a polyline, not just two endpoints, on purpose:
 * every consumer walks it by arc-length fraction (`positionAlongLane`)
 * rather than assuming exactly two points, so a lane could gain a bend
 * around an obstacle later without any call site changing. Today every lane
 * is a straight line — see the module docstring in `environmentLayout.ts`
 * for why that's the deliberate, "simplest reliable option" choice for this
 * shooting-gallery layout, not a placeholder for something more.
 */

export type Vec3 = readonly [number, number, number]

export interface Lane {
  id: number
  spawn: Vec3
  playerBoundary: Vec3
  waypoints: Vec3[]
  /** Full corridor width (not half-width) a carrier's collision capsule may
   * occupy without leaving its lane. */
  width: number
}

export interface LaneLayoutConfig {
  /** Distance between adjacent lane centerlines. */
  laneSpacingX: number
  /** Corridor width per lane — always narrower than spacing so adjacent
   * corridors never touch. */
  laneWidth: number
}

/** Axis-aligned bounding box of a lane's corridor in the XZ plane (Y spans
 * a generous head-height range) — the region decorative environment
 * geometry must never enter. */
export interface CorridorBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

const LANE_COUNT = 4
const GROUND_Y = 0
const CORRIDOR_HEIGHT = 2.4

/** World-space Z of the portal/spawn point and the player-contact boundary.
 * Tuned via manual playtesting (see EquationOutbreakScene's prior DANGER_Z
 * history) — kept here now that lane geometry owns them, not the renderer. */
export const SPAWN_Z = -13
export const PLAYER_BOUNDARY_Z = 0.5

const MIN_ASPECT = 0.5
const MAX_ASPECT = 2.4
const NARROW_LAYOUT: LaneLayoutConfig = { laneSpacingX: 1.35, laneWidth: 1.0 }
const WIDE_LAYOUT: LaneLayoutConfig = { laneSpacingX: 1.9, laneWidth: 1.4 }

/** The widest a lane's corridor ever gets across the whole responsive
 * range — decorative props are placed clear of *this*, not just the
 * default layout, so they stay clear of every lane at every viewport size
 * without needing to move on resize (see `environmentColliders.ts`). */
export const WIDEST_LAYOUT: LaneLayoutConfig = WIDE_LAYOUT

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function inverseLerp(a: number, b: number, value: number): number {
  return (value - a) / (b - a)
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
}

/** Maps the current viewport aspect ratio to a lane layout — narrower
 * (taller) viewports pull lanes closer together so all four stay in frame;
 * wide desktop viewports get roomier spacing. Purely a rendering concern:
 * `zombieWaveEngine` never sees or cares about any of this. */
export function computeLaneLayout(aspectRatio: number): LaneLayoutConfig {
  const clamped = clamp(aspectRatio, MIN_ASPECT, MAX_ASPECT)
  const t = inverseLerp(MIN_ASPECT, MAX_ASPECT, clamped)
  return {
    laneSpacingX: lerp(NARROW_LAYOUT.laneSpacingX, WIDE_LAYOUT.laneSpacingX, t),
    laneWidth: lerp(NARROW_LAYOUT.laneWidth, WIDE_LAYOUT.laneWidth, t),
  }
}

/** Builds the four lanes for a given layout (defaults to a 16:9-ish layout
 * for callers — tests, non-responsive contexts — that don't need to react
 * to viewport size). Lane ids are stable (0..3, left to right) regardless
 * of layout, matching `Carrier.lane` from `zombieWaveEngine`. */
export function buildLanes(layout: LaneLayoutConfig = computeLaneLayout(16 / 9)): Lane[] {
  const centerOffset = (LANE_COUNT - 1) / 2
  return Array.from({ length: LANE_COUNT }, (_, id) => {
    const x = (id - centerOffset) * layout.laneSpacingX
    const spawn: Vec3 = [x, GROUND_Y, SPAWN_Z]
    const playerBoundary: Vec3 = [x, GROUND_Y, PLAYER_BOUNDARY_Z]
    return { id, spawn, playerBoundary, waypoints: [spawn, playerBoundary], width: layout.laneWidth }
  })
}

/** Default lanes for callers that don't need viewport-responsive spacing
 * (tests, and any non-responsive consumer). */
export const DEFAULT_LANES: Lane[] = buildLanes()

/** Maps normalized approach progress (0 = spawn, 1 = player boundary — the
 * same scale as `Carrier.distance`) onto a lane's waypoint path, walking it
 * by arc-length fraction. */
export function positionAlongLane(lane: Lane, t: number): Vec3 {
  const clampedT = clamp(t, 0, 1)
  const waypoints = lane.waypoints
  if (waypoints.length === 0) return [0, GROUND_Y, 0]
  if (waypoints.length === 1) return waypoints[0]

  const segmentLengths = waypoints.slice(1).map((point, i) => distance(waypoints[i], point))
  const total = segmentLengths.reduce((sum, len) => sum + len, 0)
  if (total === 0) return waypoints[0]

  let remaining = clampedT * total
  for (let i = 0; i < segmentLengths.length; i++) {
    const len = segmentLengths[i]
    const isLastSegment = i === segmentLengths.length - 1
    if (remaining <= len || isLastSegment) {
      const segT = len === 0 ? 0 : clamp(remaining / len, 0, 1)
      const a = waypoints[i]
      const b = waypoints[i + 1]
      return [lerp(a[0], b[0], segT), lerp(a[1], b[1], segT), lerp(a[2], b[2], segT)]
    }
    remaining -= len
  }
  return waypoints[waypoints.length - 1]
}

/** A lane's corridor as an axis-aligned box — the region decorative
 * environment geometry must never overlap (see `isCorridorClearOfColliders`
 * in `environmentColliders.ts`) and the region a carrier's position must
 * always remain inside. */
export function laneCorridor(lane: Lane): CorridorBox {
  const xs = lane.waypoints.map((w) => w[0])
  const zs = lane.waypoints.map((w) => w[2])
  const halfWidth = lane.width / 2
  return {
    minX: Math.min(...xs) - halfWidth,
    maxX: Math.max(...xs) + halfWidth,
    minY: 0,
    maxY: CORRIDOR_HEIGHT,
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  }
}

export function isWithinCorridor(point: Vec3, corridor: CorridorBox): boolean {
  return point[0] >= corridor.minX && point[0] <= corridor.maxX && point[2] >= corridor.minZ && point[2] <= corridor.maxZ
}

/** The outermost X a lane corridor's edge can ever reach across the whole
 * responsive range — the baseline decorative props must clear (see
 * `safePropStartX` in `environmentColliders.ts`, which adds a margin on
 * top of this). */
export function widestCorridorOuterEdgeX(): number {
  const lanes = buildLanes(WIDEST_LAYOUT)
  const outer = lanes[lanes.length - 1]
  return outer.spawn[0] + outer.width / 2
}
