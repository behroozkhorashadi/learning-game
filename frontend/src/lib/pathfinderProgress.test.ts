import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeLevelStatuses, getCompletedLevelIds, markLevelCompleted } from './pathfinderProgress'
import type { DotPuzzle } from './pathfinderTypes'

function puzzle(id: string): DotPuzzle {
  return { id, difficulty: 'easy', rows: 1, columns: 2, dots: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }
}

const LEVELS = [puzzle('a'), puzzle('b'), puzzle('c')]

describe('pathfinderProgress', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with nothing completed for a fresh profile', () => {
    expect(getCompletedLevelIds(1)).toEqual(new Set())
  })

  it('markLevelCompleted persists and getCompletedLevelIds reads it back', () => {
    markLevelCompleted(1, 'a')
    expect(getCompletedLevelIds(1)).toEqual(new Set(['a']))
  })

  it('scopes progress per profile — one profile completing a level does not affect another', () => {
    markLevelCompleted(1, 'a')
    expect(getCompletedLevelIds(2)).toEqual(new Set())
  })

  it('marking the same level completed twice is idempotent', () => {
    markLevelCompleted(1, 'a')
    markLevelCompleted(1, 'a')
    expect(getCompletedLevelIds(1)).toEqual(new Set(['a']))
  })

  it('a corrupted/inaccessible localStorage does not throw and falls back to empty', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getCompletedLevelIds(1)).toEqual(new Set())
    spy.mockRestore()
  })

  describe('computeLevelStatuses', () => {
    it('the first level is always unlocked, even with nothing completed', () => {
      const statuses = computeLevelStatuses(LEVELS, new Set())
      expect(statuses[0]).toMatchObject({ unlocked: true, completed: false })
      expect(statuses[1].unlocked).toBe(false)
      expect(statuses[2].unlocked).toBe(false)
    })

    it('completing a level unlocks exactly the next one, not further ahead', () => {
      const statuses = computeLevelStatuses(LEVELS, new Set(['a']))
      expect(statuses[0].completed).toBe(true)
      expect(statuses[1].unlocked).toBe(true)
      expect(statuses[1].completed).toBe(false)
      expect(statuses[2].unlocked).toBe(false)
    })

    it('completing levels out of declared order still only unlocks by position, not by count', () => {
      // Completed 'c' (last) but not 'b' — 'b' still gates level 3's unlock.
      const statuses = computeLevelStatuses(LEVELS, new Set(['a', 'c']))
      expect(statuses[1].unlocked).toBe(true) // b: unlocked because a is done
      expect(statuses[2].unlocked).toBe(false) // c: locked because b isn't done, despite c itself being "completed"
    })

    it('every level completed unlocks and completes the whole list', () => {
      const statuses = computeLevelStatuses(LEVELS, new Set(['a', 'b', 'c']))
      expect(statuses.every((s) => s.unlocked && s.completed)).toBe(true)
    })
  })
})
