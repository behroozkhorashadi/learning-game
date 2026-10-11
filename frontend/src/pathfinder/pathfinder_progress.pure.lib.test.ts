import { describe, expect, it } from 'vitest'
import { computeLevelStatuses } from './pathfinder_progress.pure.lib.ts'
import type { DotPuzzle } from './pathfinder_state.pure.lib.ts'

function puzzle(id: string): DotPuzzle {
  return { id, difficulty: 'easy', rows: 1, columns: 2, dots: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }
}

const LEVELS = [puzzle('a'), puzzle('b'), puzzle('c')]

const unlocked = (ids: ReadonlySet<string>): readonly boolean[] => computeLevelStatuses(LEVELS, ids).map((s) => s.unlocked)
const completed = (ids: ReadonlySet<string>): readonly boolean[] => computeLevelStatuses(LEVELS, ids).map((s) => s.completed)

describe('computeLevelStatuses', () => {
  it('the first level is always unlocked, even with nothing completed', () => {
    expect(unlocked(new Set())).toEqual([true, false, false])
    expect(completed(new Set())).toEqual([false, false, false])
  })

  it('completing a level unlocks exactly the next one, not further ahead', () => {
    expect(unlocked(new Set(['a']))).toEqual([true, true, false])
    expect(completed(new Set(['a']))).toEqual([true, false, false])
  })

  it('completing levels out of declared order still only unlocks by position, not by count', () => {
    // Completed 'c' (last) but not 'b' — 'b' still gates level 3's unlock.
    expect(unlocked(new Set(['a', 'c']))).toEqual([true, true, false])
  })

  it('every level completed unlocks and completes the whole list', () => {
    const statuses = computeLevelStatuses(LEVELS, new Set(['a', 'b', 'c']))
    expect(statuses.every((s) => s.unlocked && s.completed)).toBe(true)
  })
})
