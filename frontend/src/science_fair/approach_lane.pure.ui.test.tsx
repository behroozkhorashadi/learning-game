import ReactThreeTestRenderer from '@react-three/test-renderer'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LANES } from '@app/arena/lane_navigation.pure.lib.ts'
import { ApproachLane } from './approach_lane.pure.ui.tsx'

describe('ApproachLane', () => {
  it('lays a floor strip over the whole lane, a little narrower than its corridor', async () => {
    const lane = DEFAULT_LANES[0]
    if (lane === undefined) throw new Error('need a lane')
    const renderer = await ReactThreeTestRenderer.create(<ApproachLane lane={lane} color="#9D57FA" />)
    const strip = renderer.scene.children[0]?.instance
    expect(strip?.position.x).toBe(lane.spawn[0])
    expect(strip?.position.z).toBeCloseTo((lane.spawn[2] + lane.playerBoundary[2]) / 2)
    expect(strip?.scale.y).toBeCloseTo(Math.abs(lane.playerBoundary[2] - lane.spawn[2]))
    expect(strip?.scale.x).toBeCloseTo(lane.width * 0.82)
  })
})
