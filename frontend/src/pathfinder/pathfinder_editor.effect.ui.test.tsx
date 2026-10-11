import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedMap } from './pathfinder_fakes.test.lib.ts'
import { fakePathfinderScreens, type FakePathfinderScreens } from './pathfinder_screens.test.ui.tsx'
import type { DotPuzzle } from './pathfinder_state.pure.lib.ts'

/**
 * Drives the builder through real clicks: place dots, check solvability,
 * confirm the solution preview appears, play and save the result. Uses a
 * small 2x2 full square (always solvable — a 4-cycle has a Hamiltonian
 * path) so tests don't depend on any curated-level shape. Naming happens at
 * save time through the injected dialogs, scripted per test.
 */

const PROFILE_ID = 1
let screens: FakePathfinderScreens

beforeEach(() => {
  screens = fakePathfinderScreens()
})

afterEach(cleanup)

function renderEditor(onPlay: (puzzle: DotPuzzle) => void = vi.fn(), onViewMyMaps: () => void = vi.fn()): void {
  render(<screens.Editor profileId={PROFILE_ID} username="mia" onPlay={onPlay} onViewMyMaps={onViewMyMaps} />)
}

function gridCell(row: number, col: number): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`row ${String(row)}, column ${String(col)},`) })
}

function input(label: string): HTMLInputElement {
  const found = screen.getByLabelText(label)
  if (!(found instanceof HTMLInputElement)) throw new Error(`${label} should be an input`)
  return found
}

function place2x2Square(): void {
  fireEvent.click(gridCell(1, 1))
  fireEvent.click(gridCell(1, 2))
  fireEvent.click(gridCell(2, 2))
  fireEvent.click(gridCell(2, 1))
}

const checkPuzzle = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Check My Puzzle' }))
}
const save = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
}
const savedNames = (): readonly (string | undefined)[] => screens.server.maps().map((m) => m.puzzle.name)

describe('PathfinderEditor', () => {
  it('has no Name field — only Rows, Columns, and My Maps controls', () => {
    renderEditor()
    expect(screen.queryByLabelText(/^Name$/)).toBeNull()
    expect(input('Rows').value).toBe('6')
    expect(input('Columns').value).toBe('6')
    expect(screen.getByRole('button', { name: 'My Maps' })).toBeTruthy()
  })

  it('lets you type a two-digit size like 12 one keystroke at a time', () => {
    renderEditor()
    const rows = input('Rows')
    fireEvent.change(rows, { target: { value: '' } })
    fireEvent.change(rows, { target: { value: '1' } })
    expect(rows.value).toBe('1')
    fireEvent.change(rows, { target: { value: '12' } })
    expect(rows.value).toBe('12')
    expect(screen.getByRole('group', { name: /12 rows by 6 columns/ })).toBeTruthy()
  })

  it('clamps an out-of-range size once the field loses focus, or on Enter', () => {
    renderEditor()
    const columns = input('Columns')
    fireEvent.change(columns, { target: { value: '1' } })
    fireEvent.blur(columns)
    expect(columns.value).toBe('3')
    expect(screen.getByRole('group', { name: /6 rows by 3 columns/ })).toBeTruthy()

    fireEvent.change(columns, { target: { value: '99' } })
    fireEvent.keyDown(columns, { key: 'Enter' })
    expect(screen.getByRole('group', { name: /6 rows by 50 columns/ })).toBeTruthy()
  })

  it('shrinking the grid drops dots that fall outside it', () => {
    renderEditor()
    fireEvent.click(gridCell(1, 1))
    fireEvent.click(gridCell(5, 5))
    fireEvent.change(input('Rows'), { target: { value: '3' } })
    expect(screen.getByText('1 dots placed')).toBeTruthy()
  })

  it('placing only one dot leaves Check My Puzzle inert (DenButton drops onClick while disabled)', () => {
    renderEditor()
    fireEvent.click(gridCell(1, 1))
    checkPuzzle()
    expect(screen.queryByText(/Solvable/)).toBeNull()
  })

  it('reports a solvable board with its assessed difficulty, and shows the solution preview', () => {
    renderEditor()
    place2x2Square()
    checkPuzzle()

    expect(screen.getByText(/Solvable! Assessed difficulty: Easy/)).toBeTruthy()
    expect(screen.getByText("Here's a solution:")).toBeTruthy()
    expect(screen.getByRole('group', { name: /Pathfinder board/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('reports not solvable for two isolated dots with no shared edge, and hides Play/Save', () => {
    renderEditor()
    fireEvent.click(gridCell(1, 1))
    fireEvent.click(gridCell(4, 4))
    checkPuzzle()
    expect(screen.getByText(/Not solvable yet/)).toBeTruthy()
    expect(screen.queryByText("Here's a solution:")).toBeNull()
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
  })

  it('toggling a cell after checking clears the stale result', () => {
    renderEditor()
    place2x2Square()
    checkPuzzle()
    expect(screen.getByText(/Solvable!/)).toBeTruthy()
    fireEvent.click(gridCell(3, 3))
    expect(screen.queryByText(/Solvable!/)).toBeNull()
  })

  it('My Maps button calls onViewMyMaps', () => {
    const onViewMyMaps = vi.fn()
    renderEditor(vi.fn(), onViewMyMaps)
    fireEvent.click(screen.getByRole('button', { name: 'My Maps' }))
    expect(onViewMyMaps).toHaveBeenCalledTimes(1)
  })

  it('Play hands the built puzzle to onPlay, with a fresh custom id, without saving it', () => {
    const played: DotPuzzle[] = []
    renderEditor((p) => {
      played.push(p)
    })
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(played).toHaveLength(1)
    expect(played[0]).toMatchObject({ id: 'custom-id-1', name: 'My Map', difficulty: 'easy' })
    expect(played[0]?.dots).toHaveLength(4)
    expect(screens.server.maps()).toEqual([])
  })

  it('Save prompts for a name (pre-filled with the auto-incrementing default) and persists on confirm', async () => {
    renderEditor()
    place2x2Square()
    checkPuzzle()
    save()

    expect(await screen.findByText(/Saved as "mia_map1"/)).toBeTruthy()
    expect(screens.dialogs.shown).toEqual(['Name your map:'])
    expect(screens.server.maps().map((m) => [m.puzzle.name, m.puzzle.difficulty])).toEqual([['mia_map1', 'easy']])
  })

  it('cancelling the Save name prompt does not persist anything', async () => {
    screens.dialogs.prompts.push(null)
    renderEditor()
    place2x2Square()
    checkPuzzle()
    save()
    await waitFor(() => {
      expect(screens.dialogs.shown).toHaveLength(1)
    })
    expect(screens.server.maps()).toEqual([])
  })

  it('a blank name in the prompt falls back to the suggested default instead of saving untitled', async () => {
    screens.dialogs.prompts.push('   ')
    renderEditor()
    place2x2Square()
    checkPuzzle()
    save()
    await screen.findByText(/Saved as/)
    expect(savedNames()).toEqual(['mia_map1'])
  })

  it('saving twice suggests the next number each time', async () => {
    renderEditor()
    place2x2Square()
    checkPuzzle()
    save()
    await screen.findByText(/Saved as "mia_map1"/)
    save()
    await screen.findByText(/Saved as "mia_map2"/)
    expect(savedNames()).toEqual(['mia_map1', 'mia_map2'])
  })

  it('suggests the next number based on maps already saved to this profile', async () => {
    await seedMap(screens.server, PROFILE_ID, { id: 'custom-x', name: 'mia_map4', difficulty: 'easy', rows: 1, columns: 1, dots: [{ row: 0, col: 0 }] })
    renderEditor()
    place2x2Square()
    checkPuzzle()
    save()
    expect(await screen.findByText(/Saved as "mia_map5"/)).toBeTruthy()
  })

  it('tells the player when saving fails', async () => {
    renderEditor()
    place2x2Square()
    checkPuzzle()
    screens.server.failing = true
    save()
    expect(await screen.findByText(/Couldn't save your map/)).toBeTruthy()
  })

  it('Clear Grid empties every placed dot', () => {
    renderEditor()
    place2x2Square()
    expect(screen.getByText('4 dots placed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear Grid' }))
    expect(screen.getByText('0 dots placed')).toBeTruthy()
  })
})
