import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PathfinderPlayTest } from './PathfinderPlayTest'
import { solvePuzzle } from '../lib/pathfinderSolver'
import type { DotPuzzle, GridPosition } from '../lib/pathfinderTypes'

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

function dotButton(pos: GridPosition): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`row ${pos.row + 1}, column ${pos.col + 1}(,|$)`) })
}

function click(pos: GridPosition) {
  fireEvent.pointerUp(dotButton(pos))
}

describe('PathfinderPlayTest', () => {
  it('shows the puzzle name and starts at 0 progress', () => {
    render(<PathfinderPlayTest puzzle={PUZZLE} onBack={vi.fn()} />)
    expect(screen.getByText('Test Map')).toBeTruthy()
    expect(screen.getByText('0 / 6 dots connected')).toBeTruthy()
  })

  it('falls back to a generic label when the puzzle has no name', () => {
    render(<PathfinderPlayTest puzzle={{ ...PUZZLE, name: '' }} onBack={vi.fn()} />)
    expect(screen.getByText('Your Map')).toBeTruthy()
  })

  it('plays through to completion using a solver-verified path', () => {
    render(<PathfinderPlayTest puzzle={PUZZLE} onBack={vi.fn()} />)
    const solution = solvePuzzle(PUZZLE).path!
    for (const pos of solution) click(pos)
    expect(screen.getByText('6 / 6 dots connected')).toBeTruthy()
    expect(screen.getByText(/Every dot connected/)).toBeTruthy()
  })

  it('Undo and Restart work as expected', () => {
    render(<PathfinderPlayTest puzzle={PUZZLE} onBack={vi.fn()} />)
    click({ row: 0, col: 0 })
    click({ row: 0, col: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('1 / 6 dots connected')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getByText('0 / 6 dots connected')).toBeTruthy()
  })

  it('Back to Builder calls onBack', () => {
    const onBack = vi.fn()
    render(<PathfinderPlayTest puzzle={PUZZLE} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to Builder' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
