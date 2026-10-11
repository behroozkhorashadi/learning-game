import type { HordeZombie } from './horde_engine.pure.lib.ts'
import { worldPosition, type Cover } from './horde_field.pure.lib.ts'
import { CAMERA_POSITION } from './horde_scene_rules.pure.lib.ts'

/**
 * How much of a zombie the player can see past the cover: the lines from the
 * camera to its head, chest, and legs (or, lying down, three points along
 * the floor) are each checked against every cover box. All three blocked is
 * hidden; some is partial. Geometry only, so a recording can say what was on
 * screen without a picture of it. The points are approximate body heights,
 * not the animated mesh.
 */

export type Visibility = 'visible' | 'partial' | 'hidden'

type Vec3 = readonly [number, number, number]

const STANDING_HEIGHTS = [1.8, 1.3, 0.5] as const
const LYING_HEIGHT = 0.3
const LYING_SPREAD = 0.6

/** Whether the segment from `from` to `to` passes through the box (slab method). */
export function segmentHitsBox(from: Vec3, to: Vec3, min: Vec3, max: Vec3): boolean {
  let enter = 0
  let exit = 1
  for (let axis = 0; axis < 3; axis++) {
    const start = from[axis] ?? 0
    const delta = (to[axis] ?? 0) - start
    const lo = min[axis] ?? 0
    const hi = max[axis] ?? 0
    if (Math.abs(delta) < 1e-9) {
      if (start < lo || start > hi) return false
      continue
    }
    let t1 = (lo - start) / delta
    let t2 = (hi - start) / delta
    if (t1 > t2) [t1, t2] = [t2, t1]
    enter = Math.max(enter, t1)
    exit = Math.min(exit, t2)
    if (enter > exit) return false
  }
  return true
}

function blocked(point: Vec3, cover: readonly Cover[]): boolean {
  return cover.some((box) => {
    const [cx, , cz] = worldPosition(box.x, box.depth)
    return segmentHitsBox(CAMERA_POSITION, point, [cx - box.halfWidth, 0, cz - box.halfDepth], [cx + box.halfWidth, box.height, cz + box.halfDepth])
  })
}

export function visibilityOf(zombie: HordeZombie, cover: readonly Cover[]): Visibility {
  const [x, , z] = worldPosition(zombie.x, zombie.depth)
  const lying = zombie.posture === 'downed' || zombie.posture === 'rising' || zombie.posture === 'dead'
  const points: readonly Vec3[] = lying ? [-LYING_SPREAD, 0, LYING_SPREAD].map((dz): Vec3 => [x, LYING_HEIGHT, z + dz]) : STANDING_HEIGHTS.map((y): Vec3 => [x, y, z])
  const hidden = points.filter((point) => blocked(point, cover)).length
  return hidden === 0 ? 'visible' : hidden === points.length ? 'hidden' : 'partial'
}
