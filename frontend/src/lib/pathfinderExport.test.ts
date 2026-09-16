import { describe, it, expect } from 'vitest'
import { formatLevelCode, makeLevelId } from './pathfinderExport'
import type { DotPuzzle } from './pathfinderTypes'

describe('makeLevelId', () => {
  it('slugifies the name and prefixes it with the difficulty', () => {
    expect(makeLevelId('medium', 'Wide Field')).toBe('medium-wide-field')
  })

  it('strips punctuation and collapses whitespace/symbols to single hyphens', () => {
    expect(makeLevelId('hard', "  The  Zig-Zag!! ")).toBe('hard-the-zig-zag')
  })

  it('falls back to "map" for a name with nothing slug-worthy in it', () => {
    expect(makeLevelId('easy', '!!!')).toBe('easy-map')
  })
})

describe('formatLevelCode', () => {
  const puzzle: DotPuzzle = {
    id: 'easy-my-map',
    name: 'My Map',
    difficulty: 'easy',
    rows: 2,
    columns: 2,
    dots: [
      { row: 1, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 0 },
    ],
  }

  it('includes every field the DotPuzzle type requires', () => {
    const code = formatLevelCode(puzzle)
    expect(code).toContain("id: 'easy-my-map'")
    expect(code).toContain("name: 'My Map'")
    expect(code).toContain("difficulty: 'easy'")
    expect(code).toContain('rows: 2')
    expect(code).toContain('columns: 2')
  })

  it('lists dots sorted by row then column, not insertion order', () => {
    const code = formatLevelCode(puzzle)
    const dotsSection = code.slice(code.indexOf('dots: ['))
    const order = ['row: 0, col: 0', 'row: 0, col: 1', 'row: 1, col: 0']
    let lastIndex = -1
    for (const needle of order) {
      const idx = dotsSection.indexOf(needle)
      expect(idx).toBeGreaterThan(lastIndex)
      lastIndex = idx
    }
  })

  it("escapes a single quote in the name so the output stays valid TS", () => {
    const code = formatLevelCode({ ...puzzle, name: "Kid's Map" })
    expect(code).toContain("name: 'Kid\\'s Map'")
  })
})
