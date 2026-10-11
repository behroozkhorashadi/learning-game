import { describe, expect, it } from 'vitest'
import { check, initialTiles, isComplete, placeTile, removeFromSlot, showHint, tapTile, tryAgain, undo, type BoardItem } from './tile_placement.pure.lib.ts'

const ITEM: BoardItem = {
  kind: 'equation',
  instruction: 'Pick the tile',
  spoken: '7',
  slots: 2,
  answer: ['3', '+'],
  tiles: [
    { id: 'a', label: '3' },
    { id: 'b', label: '+' },
    { id: 'c', label: '9' },
  ],
}

describe('tile placement', () => {
  it('taps fill the first empty slot; a full board ignores more taps', () => {
    let s = initialTiles(ITEM)
    s = tapTile(s, 'a', null)
    s = tapTile(s, 'b', null)
    expect(s.placements).toEqual(['a', 'b'])
    expect(tapTile(s, 'c', null)).toBe(s)
    expect(isComplete(s)).toBe(true)
  })

  it('a tile is never in two slots, and dragging onto an occupied slot swaps', () => {
    let s = placeTile(initialTiles(ITEM), 'a', 0, null)
    s = placeTile(s, 'b', 1, null)
    expect(placeTile(s, 'a', 1, 0).placements).toEqual(['b', 'a'])
    expect(placeTile(s, 'c', 0, null).placements).toEqual(['c', 'b'])
  })

  it('undo removes the most recently filled slot', () => {
    let s = placeTile(initialTiles(ITEM), 'b', 1, null)
    s = placeTile(s, 'a', 0, null)
    expect(undo(s).placements).toEqual([null, 'b'])
    expect(undo(undo(undo(s))).placements).toEqual([null, null])
  })

  it('removing clears the slot and its history', () => {
    const s = removeFromSlot(placeTile(initialTiles(ITEM), 'a', 0, null), 0)
    expect([s.placements, s.history]).toEqual([[null, null], []])
  })

  it('check scores by label and reports hints and a spaced value for equations', () => {
    const s = showHint(placeTile(placeTile(initialTiles(ITEM), 'a', 0, null), 'b', 1, null))
    const { state, result } = check(s, ITEM)
    expect(result).toEqual({ kind: 'equation', correct: true, placement: ['a', 'b'], value: '3 +', hintsUsed: 1 })
    expect([state.feedback, state.hintOn]).toEqual(['correct', false])
  })

  it('try again keeps the right tiles only', () => {
    const s = placeTile(placeTile(initialTiles(ITEM), 'a', 0, null), 'c', 1, null)
    const checked = check(s, ITEM)
    expect(checked.result.correct).toBe(false)
    const again = tryAgain(checked.state, ITEM)
    expect([again.placements, again.history, again.feedback]).toEqual([['a', null], [0], 'none'])
  })
})
