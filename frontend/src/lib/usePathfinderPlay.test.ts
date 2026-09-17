import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { usePathfinderPlay } from './usePathfinderPlay'
import type { DotPuzzle } from './pathfinderTypes'

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

describe('usePathfinderPlay', () => {
  it('starts with an empty path', () => {
    const { result } = renderHook(() => usePathfinderPlay(PUZZLE))
    expect(result.current.path).toEqual([])
    expect(result.current.completed).toBe(false)
    expect(result.current.canUndo).toBe(false)
  })

  it('extends the path on a valid adjacent click', () => {
    const { result } = renderHook(() => usePathfinderPlay(PUZZLE))
    act(() => result.current.handleDotClick({ row: 0, col: 0 }))
    act(() => result.current.handleDotClick({ row: 0, col: 1 }))
    expect(result.current.path).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }])
    expect(result.current.progress).toEqual({ visited: 2, total: 6 })
  })

  it('rejects a non-adjacent click and surfaces an invalid-move message', () => {
    const { result } = renderHook(() => usePathfinderPlay(PUZZLE))
    act(() => result.current.handleDotClick({ row: 0, col: 0 }))
    act(() => result.current.handleDotClick({ row: 1, col: 2 }))
    expect(result.current.path).toHaveLength(1)
    expect(result.current.invalidReason).toBeTruthy()
  })

  it('Undo removes exactly the last move', () => {
    const { result } = renderHook(() => usePathfinderPlay(PUZZLE))
    act(() => result.current.handleDotClick({ row: 0, col: 0 }))
    act(() => result.current.handleDotClick({ row: 0, col: 1 }))
    act(() => result.current.handleUndo())
    expect(result.current.path).toEqual([{ row: 0, col: 0 }])
  })

  it('Restart clears the whole path', () => {
    const { result } = renderHook(() => usePathfinderPlay(PUZZLE))
    act(() => result.current.handleDotClick({ row: 0, col: 0 }))
    act(() => result.current.handleRestart())
    expect(result.current.path).toEqual([])
  })

  it('calls onComplete exactly once, at the moment the path completes the puzzle', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => usePathfinderPlay(PUZZLE, onComplete))
    const solution: Array<{ row: number; col: number }> = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 1, col: 1 },
      { row: 1, col: 0 },
    ]
    for (const pos of solution) act(() => result.current.handleDotClick(pos))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(result.current.completed).toBe(true)
  })

  it('blocks further clicks once completed', () => {
    const { result } = renderHook(() => usePathfinderPlay(PUZZLE))
    const solution: Array<{ row: number; col: number }> = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 1, col: 1 },
      { row: 1, col: 0 },
    ]
    for (const pos of solution) act(() => result.current.handleDotClick(pos))
    act(() => result.current.handleDotClick({ row: 1, col: 0 }))
    expect(result.current.path).toHaveLength(6)
  })

  it('resets the path automatically when the puzzle changes', () => {
    const other: DotPuzzle = { ...PUZZLE, id: 'other-rect' }
    const { result, rerender } = renderHook(({ puzzle }) => usePathfinderPlay(puzzle), { initialProps: { puzzle: PUZZLE } })
    act(() => result.current.handleDotClick({ row: 0, col: 0 }))
    expect(result.current.path).toHaveLength(1)

    rerender({ puzzle: other })
    expect(result.current.path).toEqual([])
  })
})
