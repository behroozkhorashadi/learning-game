import { describe, it, expect } from 'vitest'
import {
  buildLanes,
  computeLaneLayout,
  positionAlongLane,
  laneCorridor,
  isWithinCorridor,
  widestCorridorOuterEdgeX,
  DEFAULT_LANES,
  SPAWN_Z,
  PLAYER_BOUNDARY_Z,
  WIDEST_LAYOUT,
  type Lane,
} from './laneNavigation'

describe('buildLanes', () => {
  it('produces exactly four lanes with stable, distinct ids', () => {
    const lanes = buildLanes()
    expect(lanes).toHaveLength(4)
    expect(lanes.map((l) => l.id)).toEqual([0, 1, 2, 3])
  })

  it('gives every lane a valid spawn and player-boundary endpoint', () => {
    for (const lane of buildLanes()) {
      expect(lane.spawn[2]).toBe(SPAWN_Z)
      expect(lane.playerBoundary[2]).toBe(PLAYER_BOUNDARY_Z)
      expect(lane.waypoints[0]).toEqual(lane.spawn)
      expect(lane.waypoints[lane.waypoints.length - 1]).toEqual(lane.playerBoundary)
    }
  })

  it('orders lanes left to right by x', () => {
    const lanes = buildLanes()
    const xs = lanes.map((l) => l.spawn[0])
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })

  it('keeps adjacent lane corridors from overlapping, across the responsive range', () => {
    for (const aspectRatio of [0.5, 0.75, 1, 1.33, 1.78, 2.4]) {
      const lanes = buildLanes(computeLaneLayout(aspectRatio))
      for (let i = 1; i < lanes.length; i++) {
        const prevCorridor = laneCorridor(lanes[i - 1])
        const corridor = laneCorridor(lanes[i])
        expect(prevCorridor.maxX).toBeLessThanOrEqual(corridor.minX)
      }
    }
  })
})

describe('positionAlongLane', () => {
  it('returns the spawn point at t=0 and the player boundary at t=1', () => {
    const lane = DEFAULT_LANES[1]
    expect(positionAlongLane(lane, 0)).toEqual(lane.spawn)
    expect(positionAlongLane(lane, 1)).toEqual(lane.playerBoundary)
  })

  it('clamps t outside [0, 1]', () => {
    const lane = DEFAULT_LANES[0]
    expect(positionAlongLane(lane, -0.5)).toEqual(lane.spawn)
    expect(positionAlongLane(lane, 1.5)).toEqual(lane.playerBoundary)
  })

  it('interpolates linearly for a straight two-point lane', () => {
    const lane = DEFAULT_LANES[2]
    const mid = positionAlongLane(lane, 0.5)
    expect(mid[0]).toBeCloseTo(lane.spawn[0])
    expect(mid[2]).toBeCloseTo((lane.spawn[2] + lane.playerBoundary[2]) / 2)
  })

  it('keeps every sampled point on the path inside that lane’s own corridor', () => {
    for (const lane of DEFAULT_LANES) {
      const corridor = laneCorridor(lane)
      for (let t = 0; t <= 1; t += 0.05) {
        expect(isWithinCorridor(positionAlongLane(lane, t), corridor)).toBe(true)
      }
    }
  })

  it('walks a multi-waypoint path by arc-length fraction, not by waypoint index', () => {
    const lane: Lane = {
      id: 0,
      spawn: [0, 0, -10],
      playerBoundary: [0, 0, 0],
      width: 1,
      waypoints: [
        [0, 0, -10],
        [0, 0, -8],
        [0, 0, 0],
      ],
    }
    // First segment is 2 units of a 10-unit total path (20%); t=0.1 should
    // land halfway through that short first segment, not at its end.
    const point = positionAlongLane(lane, 0.1)
    expect(point[2]).toBeCloseTo(-9)
  })
})

describe('computeLaneLayout', () => {
  it('produces a narrower corridor width than lane spacing at every sampled aspect ratio', () => {
    for (const aspectRatio of [0.4, 0.5, 1, 1.78, 2.4, 3]) {
      const layout = computeLaneLayout(aspectRatio)
      expect(layout.laneWidth).toBeLessThan(layout.laneSpacingX)
    }
  })

  it('never exceeds the documented widest layout', () => {
    for (const aspectRatio of [1.78, 2.4, 10]) {
      const layout = computeLaneLayout(aspectRatio)
      expect(layout.laneSpacingX).toBeLessThanOrEqual(WIDEST_LAYOUT.laneSpacingX)
      expect(layout.laneWidth).toBeLessThanOrEqual(WIDEST_LAYOUT.laneWidth)
    }
  })
})

describe('widestCorridorOuterEdgeX', () => {
  it('matches the outer lane computed directly from WIDEST_LAYOUT', () => {
    const lanes = buildLanes(WIDEST_LAYOUT)
    const outer = lanes[lanes.length - 1]
    expect(widestCorridorOuterEdgeX()).toBeCloseTo(outer.spawn[0] + outer.width / 2)
  })
})
