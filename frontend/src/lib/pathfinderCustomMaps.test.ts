import { describe, it, expect, beforeEach } from 'vitest'
import { installFakePathfinderApi, type FakePathfinderApi } from './fakePathfinderApi'
import {
  deleteCustomMap,
  listCustomMaps,
  makeCustomMapId,
  nextDefaultMapName,
  renameCustomMap,
  saveCustomMap,
  setCustomMapPublished,
  type CustomMapRecord,
} from './pathfinderCustomMaps'
import type { DotPuzzle } from './pathfinderTypes'

function makePuzzle(id: string, name = 'My Puzzle'): DotPuzzle {
  return {
    id,
    name,
    difficulty: 'easy',
    rows: 2,
    columns: 2,
    dots: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 0 },
    ],
  }
}

function record(name: string): CustomMapRecord {
  return { puzzle: makePuzzle(`custom-${name}`, name), createdAt: '', published: false }
}

describe('pathfinderCustomMaps', () => {
  let api: FakePathfinderApi

  beforeEach(() => {
    api = installFakePathfinderApi()
  })

  it('starts empty with nothing saved', async () => {
    expect(await listCustomMaps(1)).toEqual([])
  })

  it('saves a map and lists it back as a record with createdAt and published: false', async () => {
    const puzzle = makePuzzle('custom-1')
    const saved = await saveCustomMap(1, puzzle)
    expect(saved.puzzle).toEqual(puzzle)
    expect(saved.published).toBe(false)
    expect(saved.createdAt).toBeTruthy()

    const all = await listCustomMaps(1)
    expect(all).toEqual([saved])
  })

  it('lists most recently created first', async () => {
    await saveCustomMap(1, makePuzzle('custom-1', 'First'))
    await saveCustomMap(1, makePuzzle('custom-2', 'Second'))
    await saveCustomMap(1, makePuzzle('custom-3', 'Third'))
    expect((await listCustomMaps(1)).map((r) => r.puzzle.name)).toEqual(['Third', 'Second', 'First'])
  })

  it("keeps each profile's maps separate", async () => {
    await saveCustomMap(1, makePuzzle('custom-1'))
    expect(await listCustomMaps(2)).toEqual([])
  })

  it('deleteCustomMap removes only the targeted map', async () => {
    await saveCustomMap(1, makePuzzle('custom-1'))
    await saveCustomMap(1, makePuzzle('custom-2'))
    await deleteCustomMap(1, 'custom-1')
    expect((await listCustomMaps(1)).map((r) => r.puzzle.id)).toEqual(['custom-2'])
  })

  it('renameCustomMap changes only the name, keeping id, createdAt, and published untouched', async () => {
    const saved = await saveCustomMap(1, makePuzzle('custom-1', 'Old Name'))
    await setCustomMapPublished(1, 'custom-1', true)
    await renameCustomMap(1, 'custom-1', 'New Name')

    const [only] = await listCustomMaps(1)
    expect(only.puzzle.name).toBe('New Name')
    expect(only.puzzle.id).toBe('custom-1')
    expect(only.createdAt).toBe(saved.createdAt)
    expect(only.published).toBe(true)
  })

  it('setCustomMapPublished toggles only the targeted map', async () => {
    await saveCustomMap(1, makePuzzle('custom-1'))
    await saveCustomMap(1, makePuzzle('custom-2'))
    await setCustomMapPublished(1, 'custom-1', true)

    const all = await listCustomMaps(1)
    expect(all.find((r) => r.puzzle.id === 'custom-1')?.published).toBe(true)
    expect(all.find((r) => r.puzzle.id === 'custom-2')?.published).toBe(false)
  })

  it('rejects when the server fails, so callers can tell the player', async () => {
    api.failing = true
    await expect(listCustomMaps(1)).rejects.toThrow()
    await expect(saveCustomMap(1, makePuzzle('custom-1'))).rejects.toThrow()
    await expect(renameCustomMap(1, 'custom-1', 'x')).rejects.toThrow()
  })

  it('makeCustomMapId produces distinct, namespaced ids', () => {
    const a = makeCustomMapId()
    const b = makeCustomMapId()
    expect(a).not.toBe(b)
    expect(a.startsWith('custom-')).toBe(true)
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
})
