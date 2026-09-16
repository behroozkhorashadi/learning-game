import { describe, it, expect } from 'vitest'
import { ALL_LEVELS, LEVELS_BY_DIFFICULTY } from './pathfinderLevels'
import { isPuzzleSolvable } from './pathfinderSolver'

/**
 * The actual content validation the spec asks for: every hand-authored
 * level must have at least one solver-verified full path. This is what
 * makes these maps trustworthy to ship, not just the act of drawing them.
 */
describe('curated levels are all solvable', () => {
  it.each(ALL_LEVELS.map((puzzle) => [puzzle.id, puzzle] as const))('%s has a valid full path', (_id, puzzle) => {
    expect(isPuzzleSolvable(puzzle)).toBe(true)
  })
})

describe('level pool shape', () => {
  it('has at least five levels per difficulty', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(LEVELS_BY_DIFFICULTY[difficulty].length).toBeGreaterThanOrEqual(5)
    }
  })

  it('has no duplicate level ids across the whole set', () => {
    const ids = ALL_LEVELS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every level is tagged with the difficulty bucket it lives in', () => {
    for (const [difficulty, levels] of Object.entries(LEVELS_BY_DIFFICULTY)) {
      for (const level of levels) expect(level.difficulty).toBe(difficulty)
    }
  })

  it('every dot sits within the level\'s declared rows/columns bounds', () => {
    for (const puzzle of ALL_LEVELS) {
      for (const dot of puzzle.dots) {
        expect(dot.row).toBeGreaterThanOrEqual(0)
        expect(dot.row).toBeLessThan(puzzle.rows)
        expect(dot.col).toBeGreaterThanOrEqual(0)
        expect(dot.col).toBeLessThan(puzzle.columns)
      }
    }
  })

  it('has no duplicate dot positions within a single level', () => {
    for (const puzzle of ALL_LEVELS) {
      const keys = puzzle.dots.map((d) => `${d.row},${d.col}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})
