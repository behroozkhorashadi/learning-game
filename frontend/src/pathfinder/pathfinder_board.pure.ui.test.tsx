import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PathfinderBoard } from './pathfinder_board.pure.ui.tsx'
import { squarePuzzle } from './pathfinder_fakes.test.lib.ts'

afterEach(cleanup)

const PUZZLE = squarePuzzle('board')

describe('PathfinderBoard', () => {
  it('names the board and every dot, marking visited ones', () => {
    render(<PathfinderBoard puzzle={PUZZLE} path={[{ row: 0, col: 0 }]} onDotClick={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'Pathfinder board, 2 rows by 2 columns' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dot at row 1, column 1, visited' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dot at row 2, column 2' })).toBeTruthy()
  })

  it('reports the clicked dot, and has no opinion on whether the move is legal', () => {
    const onDotClick = vi.fn()
    render(<PathfinderBoard puzzle={PUZZLE} path={[]} onDotClick={onDotClick} />)
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Dot at row 2, column 2' }))
    expect(onDotClick).toHaveBeenCalledWith({ row: 1, col: 1 })
  })

  it('ignores clicks while disabled', () => {
    const onDotClick = vi.fn()
    render(<PathfinderBoard puzzle={PUZZLE} path={[]} onDotClick={onDotClick} disabled />)
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Dot at row 1, column 1' }))
    expect(onDotClick).not.toHaveBeenCalled()
  })

  it('draws one segment per step of the path', () => {
    const { container } = render(
      <PathfinderBoard
        puzzle={PUZZLE}
        path={[
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 1, col: 1 },
        ]}
        onDotClick={vi.fn()}
      />,
    )
    expect(container.querySelectorAll('line')).toHaveLength(2)
  })
})
