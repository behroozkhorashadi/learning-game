import { describe, expect, it } from 'vitest'
import type { Carrier } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import { LANE_COLORS, clipRoleFor, laneColor, sceneFov, walkPhaseFor } from './outbreak_scene_rules.pure.lib.ts'

const ACTIVE: Carrier = { id: 'a', label: '7', correct: true, lane: 0, distance: 0.2, status: 'active', defeatedBy: null }

describe('clipRoleFor', () => {
  it('idles in the intro, approaches while playing, and plays the matching end', () => {
    expect(clipRoleFor(ACTIVE, 'intro')).toBe('idle')
    expect(clipRoleFor(ACTIVE, 'playing')).toBe('approach')
    expect(clipRoleFor({ ...ACTIVE, status: 'reached_player' }, 'playing')).toBe('reach')
    expect(clipRoleFor({ ...ACTIVE, status: 'defeated', defeatedBy: 'headshot' }, 'playing')).toBe('deadHeadshot')
    expect(clipRoleFor({ ...ACTIVE, status: 'defeated', defeatedBy: 'body' }, 'playing')).toBe('deadBody')
  })
})

describe('walkPhaseFor', () => {
  it('is stable per carrier, varied across carriers, and within 0..2s', () => {
    const phases = ['item-0-0', 'item-0-1', 'item-0-2', 'item-0-3'].map(walkPhaseFor)
    expect(walkPhaseFor('item-0-0')).toBe(phases[0])
    expect(new Set(phases).size).toBe(4)
    for (const p of phases) {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThan(2)
    }
  })
})

describe('sceneFov and laneColor', () => {
  it('widens the view on tall screens, within 50..64 degrees', () => {
    expect(sceneFov(0.5)).toBe(64)
    expect(sceneFov(1.2)).toBeCloseTo(57)
    expect(sceneFov(2.4)).toBe(50)
  })

  it('cycles the four lane colours', () => {
    expect(laneColor(0)).toBe(LANE_COLORS[0])
    expect(laneColor(5)).toBe(LANE_COLORS[1])
  })
})
