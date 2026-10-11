import { describe, expect, it } from 'vitest'
import { makeCustomMapId, nextDefaultMapName } from './pathfinder_custom_maps.pure.lib.ts'
import { squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import type { CustomMapRecord } from './pathfinder_state.pure.lib.ts'

function record(name: string): CustomMapRecord {
  return { puzzle: squarePuzzle(`custom-${name}`, name), createdAt: '', published: false }
}

describe('makeCustomMapId', () => {
  it('namespaces the random id so it cannot collide with a curated level id', () => {
    const ids = ['a', 'b']
    const next = (): string => ids.shift() ?? 'z'
    expect([makeCustomMapId(next), makeCustomMapId(next)]).toEqual(['custom-a', 'custom-b'])
  })
})

describe('nextDefaultMapName', () => {
  it('suggests map1 for a username with no saved maps', () => {
    expect(nextDefaultMapName('mia', [])).toBe('mia_map1')
  })

  it('suggests one past the highest existing number for that username', () => {
    expect(nextDefaultMapName('mia', [record('mia_map1'), record('mia_map2')])).toBe('mia_map3')
  })

  it("is scoped by username prefix — another user's maps do not affect the count", () => {
    expect(nextDefaultMapName('sam', [record('mia_map1'), record('mia_map2')])).toBe('sam_map1')
  })

  it('ignores gaps and non-matching names, using the max rather than the count', () => {
    expect(nextDefaultMapName('mia', [record('mia_map1'), record('mia_map5'), record('a totally custom name')])).toBe('mia_map6')
  })
})
