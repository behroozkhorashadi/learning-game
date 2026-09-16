import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteCustomMap, listCustomMaps, makeCustomMapId, saveCustomMap } from './pathfinderCustomMaps'
import type { DotPuzzle } from './pathfinderTypes'

const STORAGE_KEY = 'pathfinder:customMaps'

function makePuzzle(id: string): DotPuzzle {
  return {
    id,
    name: 'My Puzzle',
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
  })

  it('starts empty with nothing stored', () => {
    expect(listCustomMaps()).toEqual([])
  })

  it('saves a map and lists it back', () => {
    const puzzle = makePuzzle('custom-1')
    saveCustomMap(puzzle)
    expect(listCustomMaps()).toEqual([puzzle])
  })

  it('persists across a fresh read (simulating a reload) via the namespaced storage key', () => {
    saveCustomMap(makePuzzle('custom-1'))
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(raw).toHaveLength(1)
    expect(raw[0].id).toBe('custom-1')
  })

  it('saving a map with the same id replaces the old one instead of duplicating it', () => {
    saveCustomMap(makePuzzle('custom-1'))
    const updated = { ...makePuzzle('custom-1'), name: 'Renamed' }
    saveCustomMap(updated)
    const all = listCustomMaps()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Renamed')
  })

  it('deleteCustomMap removes only the targeted map', () => {
    saveCustomMap(makePuzzle('custom-1'))
    saveCustomMap(makePuzzle('custom-2'))
    deleteCustomMap('custom-1')
    const all = listCustomMaps()
    expect(all.map((m) => m.id)).toEqual(['custom-2'])
  })

  it('makeCustomMapId produces distinct, namespaced ids', () => {
    const a = makeCustomMapId()
    const b = makeCustomMapId()
    expect(a).not.toBe(b)
    expect(a.startsWith('custom-')).toBe(true)
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
