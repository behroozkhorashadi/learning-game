import { describe, it, expect, beforeEach } from 'vitest'
import { installFakePathfinderApi, type FakePathfinderApi } from './fakePathfinderApi'
import { computeLevelStatuses, fetchCompletedLevelIds, markLevelCompleted } from './pathfinderProgress'
import type { DotPuzzle } from './pathfinderTypes'

function puzzle(id: string): DotPuzzle {
  return { id, difficulty: 'easy', rows: 1, columns: 2, dots: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }
}

const LEVELS = [puzzle('a'), puzzle('b'), puzzle('c')]

describe('pathfinderProgress', () => {
  let api: FakePathfinderApi

  beforeEach(() => {
    api = installFakePathfinderApi()
  })

  it('starts with nothing completed for a fresh profile', async () => {
    expect(await fetchCompletedLevelIds(1)).toEqual(new Set())
  })

  it('markLevelCompleted saves to the server and resolves to the updated set', async () => {
    expect(await markLevelCompleted(1, 'a')).toEqual(new Set(['a']))
    expect(await fetchCompletedLevelIds(1)).toEqual(new Set(['a']))
    expect(api.completions.get(1)).toEqual(['a'])
  })

  it('scopes progress per profile — one profile completing a level does not affect another', async () => {
    await markLevelCompleted(1, 'a')
    expect(await fetchCompletedLevelIds(2)).toEqual(new Set())
  })

  it('rejects when the server fails, so callers can tell the player', async () => {
    api.failing = true
    await expect(fetchCompletedLevelIds(1)).rejects.toThrow()
    await expect(markLevelCompleted(1, 'a')).rejects.toThrow()
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
