import { describe, expect, it } from 'vitest'
import { assembleRandomId } from './random_id.assembly.main.ts'

describe('assembleRandomId', () => {
  it('makes distinct v4 UUIDs', () => {
    const randomId = assembleRandomId()
    const ids = new Set(Array.from({ length: 50 }, randomId))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
