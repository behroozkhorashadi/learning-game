import { describe, expect, it } from 'vitest'
import { CONTACT_DEPTH, COVER, SPAWN_DEPTH, clampX, coverAt, coverInFront, fieldPoint, maxAbsX, worldPosition } from './horde_field.pure.lib.ts'

describe('horde field', () => {
  it('narrows toward the player', () => {
    expect(maxAbsX(SPAWN_DEPTH)).toBeGreaterThan(maxAbsX(CONTACT_DEPTH))
    expect(clampX(100, 5)).toBe(maxAbsX(5))
    expect(clampX(-100, 5)).toBe(-maxAbsX(5))
  })

  it('keeps every piece of cover on the field, between the player and the spawn line, apart from the others', () => {
    for (const box of COVER) {
      expect(Math.abs(box.x) + box.halfWidth).toBeLessThan(maxAbsX(box.depth))
      expect(box.depth).toBeGreaterThan(CONTACT_DEPTH + 3)
      expect(box.depth).toBeLessThan(SPAWN_DEPTH - 1)
      for (const other of COVER) {
        if (other === box) continue
        const apart = Math.abs(box.x - other.x) > box.halfWidth + other.halfWidth + 1 || Math.abs(box.depth - other.depth) > box.halfDepth + other.halfDepth + 1
        expect(apart).toBe(true)
      }
    }
  })

  it('finds cover at a point and just behind it', () => {
    const table = COVER.find((box) => box.id === 'table-middle')
    expect(coverAt(0, 11.5, 0, COVER)).toBe(table)
    expect(coverAt(0, 4, 0, COVER)).toBeNull()
    expect(coverInFront(0, 12.3, 0.9, COVER)).toBe(table)
    expect(coverInFront(0, 11.5, 0.9, COVER)).toBeNull()
  })

  it('maps field points to the scene and back', () => {
    expect(worldPosition(2, 8)).toEqual([2, 0, -8])
    expect(fieldPoint(2, -8)).toEqual({ x: 2, depth: 8 })
  })
})
