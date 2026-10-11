import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualTimers } from './pathfinder_fakes.test.lib.ts'
import { bindPathfinderPlayTest } from './pathfinder_playtest.effect.ui.tsx'
import { solvePuzzle } from './pathfinder_solver.pure.lib.ts'
import type { DotPuzzle, GridPosition } from './pathfinder_state.pure.lib.ts'

afterEach(cleanup)

const PUZZLE: DotPuzzle = {
  id: 'test-rect',
  name: 'Test Map',
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

let PlayTest: ReturnType<typeof bindPathfinderPlayTest>

beforeEach(() => {
  PlayTest = bindPathfinderPlayTest({ scheduleTimeout: manualTimers().schedule })
})

function click(pos: GridPosition): void {
  fireEvent.pointerUp(screen.getByRole('button', { name: new RegExp(`row ${String(pos.row + 1)}, column ${String(pos.col + 1)}(,|$)`) }))
}

describe('PathfinderPlayTest', () => {
  it('shows the puzzle name and starts at 0 progress', () => {
    render(<PlayTest puzzle={PUZZLE} onBack={vi.fn()} />)
    expect(screen.getByText('Test Map')).toBeTruthy()
    expect(screen.getByText('0 / 6 dots connected')).toBeTruthy()
  })

  it('falls back to a generic label when the puzzle has no name', () => {
    render(<PlayTest puzzle={{ ...PUZZLE, name: '' }} onBack={vi.fn()} />)
    expect(screen.getByText('Your Map')).toBeTruthy()
  })

  it('plays through to completion using a solver-verified path', () => {
    render(<PlayTest puzzle={PUZZLE} onBack={vi.fn()} />)
    for (const pos of solvePuzzle(PUZZLE).path ?? []) click(pos)
    expect(screen.getByText('6 / 6 dots connected')).toBeTruthy()
    expect(screen.getByText('Every dot connected! 🎉')).toBeTruthy()
  })

  it('says when no legal move is left', () => {
    render(<PlayTest puzzle={PUZZLE} onBack={vi.fn()} />)
    for (const pos of [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 1, col: 0 }, { row: 0, col: 0 }]) click(pos)
    expect(screen.getByText('No legal move from here — try Undo or Restart.')).toBeTruthy()
  })

  it('Undo and Restart work as expected', () => {
    render(<PlayTest puzzle={PUZZLE} onBack={vi.fn()} />)
    click({ row: 0, col: 0 })
    click({ row: 0, col: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('1 / 6 dots connected')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getByText('0 / 6 dots connected')).toBeTruthy()
  })

  it('Back calls onBack, with the default or a given label', () => {
    const onBack = vi.fn()
    render(<PlayTest puzzle={PUZZLE} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to Builder' }))
    cleanup()
    render(<PlayTest puzzle={PUZZLE} onBack={onBack} backLabel="Back to All Levels" />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to All Levels' }))
    expect(onBack).toHaveBeenCalledTimes(2)
  })
})
