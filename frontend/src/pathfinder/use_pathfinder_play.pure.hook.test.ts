import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manualTimers } from './pathfinder_fakes.test.lib.ts'
import type { DotPuzzle, GridPosition } from './pathfinder_state.pure.lib.ts'
import { usePathfinderPlay } from './use_pathfinder_play.pure.hook.ts'

afterEach(cleanup)

// 2x3 rectangle: rows 0-1, cols 0-2.
const PUZZLE: DotPuzzle = {
  id: 'test-rect',
  difficulty: 'easy',
  rows: 2,
  columns: 3,
  dots: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
  ],
}

const SOLUTION: readonly GridPosition[] = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: 2 },
  { row: 1, col: 2 },
  { row: 1, col: 1 },
  { row: 1, col: 0 },
]

function renderPlay(onComplete?: () => void) {
  const timers = manualTimers()
  const hook = renderHook(() => usePathfinderPlay(PUZZLE, timers.schedule, onComplete))
  const click = (pos: GridPosition): void => {
    act(() => {
      hook.result.current.handleDotClick(pos)
    })
  }
  return { ...hook, timers, click }
}

describe('usePathfinderPlay', () => {
  it('starts with an empty path', () => {
    const { result } = renderPlay()
    expect(result.current.path).toEqual([])
    expect(result.current.completed).toBe(false)
    expect(result.current.canUndo).toBe(false)
  })

  it('extends the path on a valid adjacent click', () => {
    const { result, click } = renderPlay()
    click({ row: 0, col: 0 })
    click({ row: 0, col: 1 })
    expect(result.current.path).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }])
    expect(result.current.progress).toEqual({ visited: 2, total: 6 })
  })

  it('rejects a non-adjacent click, says why, and clears the message after the feedback timer', () => {
    const { result, click, timers } = renderPlay()
    click({ row: 0, col: 0 })
    click({ row: 1, col: 2 })
    expect(result.current.path).toHaveLength(1)
    expect(result.current.invalidReason).toBe('Only in a straight line — up, down, left, or right.')
    act(() => {
      timers.fireAll()
    })
    expect(result.current.invalidReason).toBeNull()
  })

  it('a second invalid click restarts the feedback timer instead of stacking timers', () => {
    const { click, timers } = renderPlay()
    click({ row: 0, col: 0 })
    click({ row: 1, col: 2 })
    click({ row: 0, col: 0 })
    expect(timers.pending()).toBe(1)
  })

  it('cancels the feedback timer on unmount', () => {
    const { click, timers, unmount } = renderPlay()
    click({ row: 0, col: 0 })
    click({ row: 1, col: 2 })
    unmount()
    expect(timers.pending()).toBe(0)
  })

  it('a straight click past a neighbor fills in every dot along the way', () => {
    const { result, click } = renderPlay()
    click({ row: 0, col: 0 })
    click({ row: 0, col: 2 })
    expect(result.current.path).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }])
    expect(result.current.progress).toEqual({ visited: 3, total: 6 })
  })

  it('Undo takes back a whole straight-line move at once, and clears the invalid message', () => {
    const { result, click } = renderPlay()
    click({ row: 0, col: 0 })
    click({ row: 0, col: 2 })
    click({ row: 1, col: 2 })
    click({ row: 0, col: 0 })
    act(() => {
      result.current.handleUndo()
    })
    expect(result.current.path).toHaveLength(3)
    expect(result.current.invalidReason).toBeNull()
    act(() => {
      result.current.handleUndo()
    })
    expect(result.current.path).toEqual([{ row: 0, col: 0 }])
  })

  it('Restart clears the whole path', () => {
    const { result, click } = renderPlay()
    click({ row: 0, col: 0 })
    act(() => {
      result.current.handleRestart()
    })
    expect(result.current.path).toEqual([])
  })

  it('reports being stuck when no legal move remains', () => {
    const { result, click } = renderPlay()
    click({ row: 0, col: 1 })
    click({ row: 0, col: 0 })
    click({ row: 1, col: 0 })
    click({ row: 1, col: 1 })
    click({ row: 1, col: 2 })
    click({ row: 0, col: 2 })
    expect(result.current.completed).toBe(true)
    expect(result.current.stuck).toBe(false)

    const stuck = renderPlay()
    stuck.click({ row: 0, col: 1 })
    stuck.click({ row: 1, col: 1 })
    stuck.click({ row: 1, col: 0 })
    stuck.click({ row: 0, col: 0 })
    expect(stuck.result.current.stuck).toBe(true)
  })

  it('calls onComplete exactly once, at the moment the path completes the puzzle, and then ignores clicks', () => {
    const onComplete = vi.fn()
    const { result, click } = renderPlay(onComplete)
    for (const pos of SOLUTION) click(pos)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(result.current.completed).toBe(true)
    click({ row: 1, col: 0 })
    expect(result.current.path).toHaveLength(6)
  })

  it('starts a fresh attempt when the puzzle changes', () => {
    const timers = manualTimers()
    const other: DotPuzzle = { ...PUZZLE, id: 'other-rect' }
    const { result, rerender } = renderHook(({ puzzle }) => usePathfinderPlay(puzzle, timers.schedule), { initialProps: { puzzle: PUZZLE } })
    act(() => {
      result.current.handleDotClick({ row: 0, col: 0 })
    })
    expect(result.current.path).toHaveLength(1)

    rerender({ puzzle: other })
    expect(result.current.path).toEqual([])
    act(() => {
      result.current.handleDotClick({ row: 0, col: 0 })
    })
    expect(result.current.path).toHaveLength(1)
  })
})
