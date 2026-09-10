import { describe, it, expect } from 'vitest'
import { buildLanes, computeLaneLayout, DEFAULT_LANES, laneCorridor } from './laneNavigation'
import { PROP_PLACEMENTS } from './environmentLayout'
import {
  ENVIRONMENT_COLLIDERS,
  boxIntersectsCorridor,
  colliderBox,
  isCorridorClearOfColliders,
  isEnvironmentClearAcrossResponsiveRange,
  safePropStartX,
} from './environmentColliders'

describe('ENVIRONMENT_COLLIDERS', () => {
  it('has one collider per prop placement, sharing the same placement data', () => {
    expect(ENVIRONMENT_COLLIDERS).toHaveLength(PROP_PLACEMENTS.length)
    for (const [i, collider] of ENVIRONMENT_COLLIDERS.entries()) {
      expect(collider.id).toBe(PROP_PLACEMENTS[i].id)
      expect(collider.center).toEqual(PROP_PLACEMENTS[i].position)
    }
  })
})

describe('boxIntersectsCorridor', () => {
  it('detects overlap on all three axes', () => {
    const corridor = { minX: -1, maxX: 1, minY: 0, maxY: 2, minZ: -5, maxZ: 5 }
    expect(boxIntersectsCorridor({ minX: -0.5, maxX: 0.5, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }, corridor)).toBe(true)
  })

  it('reports clear when boxes sit entirely outside the corridor in X', () => {
    const corridor = { minX: -1, maxX: 1, minY: 0, maxY: 2, minZ: -5, maxZ: 5 }
    expect(boxIntersectsCorridor({ minX: 2, maxX: 3, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }, corridor)).toBe(false)
  })

  it('reports clear when boxes sit entirely outside the corridor in Z', () => {
    const corridor = { minX: -1, maxX: 1, minY: 0, maxY: 2, minZ: -5, maxZ: 5 }
    expect(boxIntersectsCorridor({ minX: 0, maxX: 0.5, minY: 0, maxY: 1, minZ: 6, maxZ: 7 }, corridor)).toBe(false)
  })
})

describe('every lane stays clear of the actual Science Fair environment', () => {
  it('is clear at the default layout', () => {
    for (const lane of DEFAULT_LANES) {
      expect(isCorridorClearOfColliders(lane)).toBe(true)
    }
  })

  it('is clear across the full responsive aspect-ratio range', () => {
    expect(isEnvironmentClearAcrossResponsiveRange([0.5, 0.75, 1, 1.33, 1.78, 2.0, 2.4])).toBe(true)
  })

  it('flags a collider that has been moved into a corridor (sanity check on the test itself)', () => {
    const lane = DEFAULT_LANES[0]
    const intrudingCollider = { id: 'test-intruder', center: lane.spawn, halfExtents: [0.5, 0.5, 0.5] as const }
    expect(isCorridorClearOfColliders(lane, [intrudingCollider])).toBe(false)
  })
})

describe('safePropStartX', () => {
  it('sits beyond every lane corridor’s outer edge across the responsive range', () => {
    const startX = safePropStartX()
    for (const aspectRatio of [0.5, 1, 1.78, 2.4]) {
      const lanes = buildLanes(computeLaneLayout(aspectRatio))
      const outerCorridor = laneCorridor(lanes[lanes.length - 1])
      expect(startX).toBeGreaterThan(outerCorridor.maxX)
    }
  })
})

describe('colliderBox', () => {
  it('derives min/max bounds from center and half-extents', () => {
    const box = colliderBox({ id: 'x', center: [1, 2, 3], halfExtents: [0.5, 1, 1.5] })
    expect(box).toEqual({ minX: 0.5, maxX: 1.5, minY: 1, maxY: 3, minZ: 1.5, maxZ: 4.5 })
  })
})
