import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PathfinderEditor } from './PathfinderEditor'
import { listCustomMaps } from '../lib/pathfinderCustomMaps'

/**
 * Drives the builder through real clicks: place dots, check solvability,
 * confirm the solution preview appears, play and save the result. Uses a
 * small 2x2 full square (always solvable — a 4-cycle has a Hamiltonian
 * path) so tests don't depend on any curated-level shape. Naming happens
 * at save time via `window.prompt`, so every save-related test stubs that.
 */

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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

function checkPuzzle() {
  fireEvent.click(screen.getByRole('button', { name: 'Check My Puzzle' }))
}

describe('PathfinderEditor', () => {
  it('has no Name field — only Rows, Columns, and My Maps controls', () => {
    render(<PathfinderEditor username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    expect(screen.queryByLabelText(/^Name$/)).toBeNull()
    expect(screen.getByText('Rows')).toBeTruthy()
    expect(screen.getByText('Columns')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'My Maps' })).toBeTruthy()
  })

  it('placing only one dot leaves Check My Puzzle inert (DenButton drops onClick while disabled)', () => {
    render(<PathfinderEditor username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    fireEvent.click(gridCell(1, 1))
    checkPuzzle()
    expect(screen.queryByText(/Solvable/)).toBeNull()
  })

  it('reports a solvable board with its assessed difficulty, and shows the solution preview', () => {
    render(<PathfinderEditor username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()

    expect(screen.getByText(/Solvable! Assessed difficulty: Easy/)).toBeTruthy()
    expect(screen.getByText("Here's a solution:")).toBeTruthy()
    expect(screen.getByRole('group', { name: /Pathfinder board/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('reports not solvable for two isolated dots with no shared edge, and hides Play/Save', () => {
    render(<PathfinderEditor username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    fireEvent.click(gridCell(1, 1))
    fireEvent.click(gridCell(4, 4))
    checkPuzzle()
    expect(screen.getByText(/Not solvable yet/)).toBeTruthy()
    expect(screen.queryByText("Here's a solution:")).toBeNull()
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
  })

  it('toggling a cell after checking clears the stale result', () => {
    render(<PathfinderEditor username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    expect(screen.getByText(/Solvable!/)).toBeTruthy()

    fireEvent.click(gridCell(3, 3))
    expect(screen.queryByText(/Solvable!/)).toBeNull()
  })

  it('My Maps button calls onViewMyMaps', () => {
    const onViewMyMaps = vi.fn()
    render(<PathfinderEditor username="mia" onPlay={vi.fn()} onViewMyMaps={onViewMyMaps} />)
    fireEvent.click(screen.getByRole('button', { name: 'My Maps' }))
    expect(onViewMyMaps).toHaveBeenCalledTimes(1)
  })

  it('Play hands the built puzzle to onPlay without requiring a save first', () => {
    const onPlay = vi.fn()
    render(<PathfinderEditor username="mia" onPlay={onPlay} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onPlay.mock.calls[0][0].dots).toHaveLength(4)
    expect(listCustomMaps()).toEqual([]) // Play alone must not persist anything
  })

  it('Save prompts for a name (pre-filled with the auto-incrementing default) and persists on confirm', () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('mia_map1')
    render(<PathfinderEditor username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(promptSpy).toHaveBeenCalledWith('Name your map:', 'mia_map1')
    const saved = listCustomMaps()
    expect(saved).toHaveLength(1)
    expect(saved[0].puzzle.name).toBe('mia_map1')
    expect(saved[0].puzzle.difficulty).toBe('easy')
    expect(screen.getByText(/Saved as "mia_map1"/)).toBeTruthy()
  })

  it('cancelling the Save name prompt (returns null) does not persist anything', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    render(<PathfinderEditor username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(listCustomMaps()).toEqual([])
  })

  it('a blank name in the prompt falls back to the suggested default instead of saving untitled', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('   ')
    render(<PathfinderEditor username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(listCustomMaps()[0].puzzle.name).toBe('mia_map1')
  })

  it('saving twice suggests the next number each time', () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValueOnce('mia_map1').mockReturnValueOnce('mia_map2')
    render(<PathfinderEditor username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(promptSpy).toHaveBeenNthCalledWith(1, 'Name your map:', 'mia_map1')
    expect(promptSpy).toHaveBeenNthCalledWith(2, 'Name your map:', 'mia_map2')
    expect(listCustomMaps()).toHaveLength(2)
  })

  it('Clear Grid empties every placed dot', () => {
    render(<PathfinderEditor username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    expect(screen.getByText('4 dots placed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear Grid' }))
    expect(screen.getByText('0 dots placed')).toBeTruthy()
  })
})
