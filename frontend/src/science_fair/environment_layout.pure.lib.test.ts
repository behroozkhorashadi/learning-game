import { describe, expect, it } from 'vitest'
import { BACK_WALL_Z, PROP_PLACEMENTS } from './environment_layout.pure.lib.ts'

describe('PROP_PLACEMENTS', () => {
  it('gives every prop a unique id and a positive size', () => {
    expect(new Set(PROP_PLACEMENTS.map((p) => p.id)).size).toBe(PROP_PLACEMENTS.length)
    for (const p of PROP_PLACEMENTS) expect(p.halfExtents.every((h) => h > 0)).toBe(true)
  })

  it('lines the side aisles with three subject booths each, mirrored left and right', () => {
    const booths = PROP_PLACEMENTS.filter((p) => p.kind === 'booth')
    expect(booths).toHaveLength(6)
    expect(booths.filter((b) => b.position[0] < 0)).toHaveLength(3)
    expect(new Set(booths.map((b) => b.subject)).size).toBe(6)
  })

  it('closes the room with a back wall behind the spawn', () => {
    expect(PROP_PLACEMENTS.find((p) => p.id === 'wall-back')?.position[2]).toBe(BACK_WALL_Z)
  })
})
