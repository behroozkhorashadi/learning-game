import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  deleteCustomMap,
  listCustomMaps,
  makeCustomMapId,
  nextDefaultMapName,
  renameCustomMap,
  saveCustomMap,
  setCustomMapPublished,
} from './pathfinderCustomMaps'
import type { DotPuzzle } from './pathfinderTypes'

const STORAGE_KEY = 'pathfinder:customMaps'

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

describe('pathfinderCustomMaps', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  it('starts empty with nothing stored', () => {
    expect(listCustomMaps()).toEqual([])
  })

  it('saves a map and lists it back as a record with createdAt and published: false', () => {
    const puzzle = makePuzzle('custom-1')
    const record = saveCustomMap(puzzle)
    expect(record.puzzle).toEqual(puzzle)
    expect(record.published).toBe(false)
    expect(typeof record.createdAt).toBe('string')

    const all = listCustomMaps()
    expect(all).toHaveLength(1)
    expect(all[0]).toEqual(record)
  })

  it('lists most recently created first', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    saveCustomMap(makePuzzle('custom-1', 'First'))
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
    saveCustomMap(makePuzzle('custom-2', 'Second'))
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'))
    saveCustomMap(makePuzzle('custom-3', 'Third'))

    const all = listCustomMaps()
    expect(all.map((r) => r.puzzle.name)).toEqual(['Third', 'Second', 'First'])
  })

  it('saving under the same id replaces the old record instead of duplicating it', () => {
    saveCustomMap(makePuzzle('custom-1', 'Original'))
    saveCustomMap(makePuzzle('custom-1', 'Replaced'))
    const all = listCustomMaps()
    expect(all).toHaveLength(1)
    expect(all[0].puzzle.name).toBe('Replaced')
  })

  it('deleteCustomMap removes only the targeted map', () => {
    saveCustomMap(makePuzzle('custom-1'))
    saveCustomMap(makePuzzle('custom-2'))
    deleteCustomMap('custom-1')
    expect(listCustomMaps().map((r) => r.puzzle.id)).toEqual(['custom-2'])
  })

  it('renameCustomMap changes only the name, keeping id, createdAt, and published untouched', () => {
    const record = saveCustomMap(makePuzzle('custom-1', 'Old Name'))
    setCustomMapPublished('custom-1', true)
    renameCustomMap('custom-1', 'New Name')

    const all = listCustomMaps()
    expect(all).toHaveLength(1)
    expect(all[0].puzzle.name).toBe('New Name')
    expect(all[0].puzzle.id).toBe('custom-1')
    expect(all[0].createdAt).toBe(record.createdAt)
    expect(all[0].published).toBe(true)
  })

  it('renaming a map that does not exist is a harmless no-op', () => {
    expect(() => renameCustomMap('nope', 'New Name')).not.toThrow()
    expect(listCustomMaps()).toEqual([])
  })

  it('setCustomMapPublished toggles only the targeted map', () => {
    saveCustomMap(makePuzzle('custom-1'))
    saveCustomMap(makePuzzle('custom-2'))
    setCustomMapPublished('custom-1', true)

    const all = listCustomMaps()
    expect(all.find((r) => r.puzzle.id === 'custom-1')?.published).toBe(true)
    expect(all.find((r) => r.puzzle.id === 'custom-2')?.published).toBe(false)
  })

  it('makeCustomMapId produces distinct, namespaced ids', () => {
    const a = makeCustomMapId()
    const b = makeCustomMapId()
    expect(a).not.toBe(b)
    expect(a.startsWith('custom-')).toBe(true)
  })

  describe('nextDefaultMapName', () => {
    it('suggests map1 for a username with no saved maps', () => {
      expect(nextDefaultMapName('mia')).toBe('mia_map1')
    })

    it('suggests one past the highest existing number for that username', () => {
      saveCustomMap(makePuzzle('custom-1', 'mia_map1'))
      saveCustomMap(makePuzzle('custom-2', 'mia_map2'))
      expect(nextDefaultMapName('mia')).toBe('mia_map3')
    })

    it('is scoped by username prefix — another user\'s maps do not affect the count', () => {
      saveCustomMap(makePuzzle('custom-1', 'mia_map1'))
      saveCustomMap(makePuzzle('custom-2', 'mia_map2'))
      expect(nextDefaultMapName('sam')).toBe('sam_map1')
    })

    it('ignores gaps and non-matching names, using the max rather than the count', () => {
      saveCustomMap(makePuzzle('custom-1', 'mia_map1'))
      saveCustomMap(makePuzzle('custom-2', 'mia_map5'))
      saveCustomMap(makePuzzle('custom-3', 'a totally custom name'))
      expect(nextDefaultMapName('mia')).toBe('mia_map6')
    })
  })

  it('a corrupted/inaccessible localStorage does not throw and falls back to an empty list', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(listCustomMaps()).toEqual([])
    spy.mockRestore()
  })

  it('saving under a blocked localStorage does not throw', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => saveCustomMap(makePuzzle('custom-1'))).not.toThrow()
    spy.mockRestore()
  })

  it('malformed JSON in storage is treated as an empty list rather than thrown', () => {
    localStorage.setItem(STORAGE_KEY, 'not json')
    expect(listCustomMaps()).toEqual([])
  })
})
