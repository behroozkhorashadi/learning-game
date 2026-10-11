import { describe, expect, it } from 'vitest'
import { createRound, type HordeZombie } from './horde_engine.pure.lib.ts'
import type { Cover } from './horde_field.pure.lib.ts'
import { segmentHitsBox, visibilityOf } from './horde_visibility.pure.lib.ts'

const ZOMBIE = createRound({ seed: 1, lives: 3, grenades: 0, shoves: 0, ammo: 0, cover: [] }).zombies[0]
function at(x: number, depth: number, change: Partial<HordeZombie> = {}): HordeZombie {
  if (ZOMBIE === undefined) throw new Error('no zombie')
  return { ...ZOMBIE, x, depth, posture: 'advancing', ...change }
}

const LOCKERS: Cover = { id: 'tall', kind: 'lockers', x: 0, depth: 8, halfWidth: 1, halfDepth: 0.4, height: 2.3 }
const CRATES: Cover = { id: 'low', kind: 'crates', x: 0, depth: 8, halfWidth: 1, halfDepth: 0.4, height: 1 }

describe('visibilityOf', () => {
  it('sees a zombie in the open', () => {
    expect(visibilityOf(at(0, 6), [LOCKERS])).toBe('visible')
    expect(visibilityOf(at(4, 10), [LOCKERS])).toBe('visible')
  })

  it('a tall piece of cover hides it completely; a low one only its legs', () => {
    expect(visibilityOf(at(0, 9), [LOCKERS])).toBe('hidden')
    expect(visibilityOf(at(0, 9), [CRATES])).toBe('partial')
  })

  it('lying down behind low cover hides it', () => {
    expect(visibilityOf(at(0, 9, { posture: 'downed' }), [CRATES])).toBe('hidden')
  })

  it('a segment that stops short of a box, or passes beside it, does not hit it', () => {
    expect(segmentHitsBox([0, 1, 0], [0, 1, -5], [-1, 0, -10], [1, 2, -8])).toBe(false)
    expect(segmentHitsBox([0, 1, 0], [5, 1, -10], [-1, 0, -10], [1, 2, -8])).toBe(false)
    expect(segmentHitsBox([0, 1, 0], [0, 1, -12], [-1, 0, -10], [1, 2, -8])).toBe(true)
  })
})
