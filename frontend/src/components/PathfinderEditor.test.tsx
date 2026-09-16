import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PathfinderEditor } from './PathfinderEditor'

/**
 * Drives the builder through real clicks: place dots, check solvability,
 * confirm the solution preview and exported code appear, save/play/delete a
 * custom map. Uses a small 2x2 full square (always solvable — a 4-cycle has
 * a Hamiltonian path) so tests don't depend on any curated-level shape.
 */

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

function gridCell(row: number, col: number): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`row ${row}, column ${col},`) })
}

function place2x2Square() {
  fireEvent.click(gridCell(1, 1))
  fireEvent.click(gridCell(1, 2))
  fireEvent.click(gridCell(2, 2))
  fireEvent.click(gridCell(2, 1))
}

describe('PathfinderEditor', () => {
  it('placing only one dot leaves Check My Puzzle inert (DenButton drops onClick while disabled)', () => {
    render(<PathfinderEditor onPlay={vi.fn()} />)
    fireEvent.click(gridCell(1, 1))
    fireEvent.click(screen.getByRole('button', { name: 'Check My Puzzle' }))
    expect(screen.queryByText(/Solvable/)).toBeNull()
  })

  it('reports a solvable board, shows the solution preview, and offers Play It!/Save & Play', () => {
    render(<PathfinderEditor onPlay={vi.fn()} />)
    place2x2Square()
    fireEvent.click(screen.getByRole('button', { name: 'Check My Puzzle' }))

    expect(screen.getByText(/Solvable!/)).toBeTruthy()
    expect(screen.getByText("Here's a solution:")).toBeTruthy()
    expect(screen.getByRole('group', { name: /Pathfinder board/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play It!' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save & Play' })).toBeTruthy()
  })

  it('reports not solvable for two isolated dots with no shared edge', () => {
    render(<PathfinderEditor onPlay={vi.fn()} />)
    fireEvent.click(gridCell(1, 1))
    fireEvent.click(gridCell(4, 4))
    fireEvent.click(screen.getByRole('button', { name: 'Check My Puzzle' }))
    expect(screen.getByText(/Not solvable yet/)).toBeTruthy()
    expect(screen.queryByText("Here's a solution:")).toBeNull()
  })

  it('toggling a cell after checking clears the stale result', () => {
    render(<PathfinderEditor onPlay={vi.fn()} />)
    place2x2Square()
    fireEvent.click(screen.getByRole('button', { name: 'Check My Puzzle' }))
    expect(screen.getByText(/Solvable!/)).toBeTruthy()

    fireEvent.click(gridCell(3, 3))
    expect(screen.queryByText(/Solvable!/)).toBeNull()
  })

  it('exports level code containing the id, difficulty, and every placed dot', () => {
    render(<PathfinderEditor onPlay={vi.fn()} />)
    place2x2Square()
    fireEvent.click(screen.getByRole('button', { name: 'Check My Puzzle' }))

    const textarea = screen.getByLabelText('Exported level code') as HTMLTextAreaElement
    expect(textarea.value).toContain("id: 'easy-my-puzzle'")
    expect(textarea.value).toContain("difficulty: 'easy'")
    expect(textarea.value).toContain('{ row: 0, col: 0 },')
    expect(textarea.value).toContain('{ row: 1, col: 1 },')
  })

  it('changing the difficulty tab changes the exported id prefix', () => {
    render(<PathfinderEditor onPlay={vi.fn()} />)
    place2x2Square()
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check My Puzzle' }))
    const textarea = screen.getByLabelText('Exported level code') as HTMLTextAreaElement
    expect(textarea.value).toContain("id: 'hard-my-puzzle'")
  })

  it('Play It! hands the built puzzle to onPlay', () => {
    const onPlay = vi.fn()
    render(<PathfinderEditor onPlay={onPlay} />)
    place2x2Square()
    fireEvent.click(screen.getByRole('button', { name: 'Check My Puzzle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play It!' }))
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onPlay.mock.calls[0][0].dots).toHaveLength(4)
  })

  it('Save & Play persists the map so it shows up under My Saved Puzzles, and Delete removes it', () => {
    render(<PathfinderEditor onPlay={vi.fn()} />)
    place2x2Square()
    fireEvent.click(screen.getByRole('button', { name: 'Check My Puzzle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save & Play' }))

    expect(screen.getByText('My Saved Puzzles')).toBeTruthy()
    expect(screen.getByText('(4 dots)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.queryByText('My Saved Puzzles')).toBeNull()
  })

  it('Clear Grid empties every placed dot', () => {
    render(<PathfinderEditor onPlay={vi.fn()} />)
    place2x2Square()
    expect(screen.getByText('4 dots placed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear Grid' }))
    expect(screen.getByText('0 dots placed')).toBeTruthy()
  })
})
