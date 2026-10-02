import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { PathfinderEditor } from './PathfinderEditor'
import { installFakePathfinderApi, type FakePathfinderApi } from '../lib/fakePathfinderApi'
import { listCustomMaps } from '../lib/pathfinderCustomMaps'

/**
 * Drives the builder through real clicks: place dots, check solvability,
 * confirm the solution preview appears, play and save the result. Uses a
 * small 2x2 full square (always solvable — a 4-cycle has a Hamiltonian
 * path) so tests don't depend on any curated-level shape. Naming happens
 * at save time via `window.prompt`, so every save-related test stubs that.
 */

const PROFILE_ID = 1
let api: FakePathfinderApi

beforeEach(() => {
  api = installFakePathfinderApi()
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
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    expect(screen.queryByLabelText(/^Name$/)).toBeNull()
    expect(screen.getByText('Rows')).toBeTruthy()
    expect(screen.getByText('Columns')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'My Maps' })).toBeTruthy()
  })

  it('lets you type a two-digit size like 12 one keystroke at a time', () => {
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    const rowsInput = screen.getByLabelText('Rows') as HTMLInputElement
    fireEvent.change(rowsInput, { target: { value: '' } })
    fireEvent.change(rowsInput, { target: { value: '1' } })
    expect(rowsInput.value).toBe('1')
    fireEvent.change(rowsInput, { target: { value: '12' } })
    expect(rowsInput.value).toBe('12')
    expect(screen.getByRole('group', { name: /12 rows by 6 columns/ })).toBeTruthy()
  })

  it('clamps an out-of-range size once the field loses focus', () => {
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    const columnsInput = screen.getByLabelText('Columns') as HTMLInputElement
    fireEvent.change(columnsInput, { target: { value: '1' } })
    fireEvent.blur(columnsInput)
    expect(columnsInput.value).toBe('3')
    expect(screen.getByRole('group', { name: /6 rows by 3 columns/ })).toBeTruthy()
  })

  it('placing only one dot leaves Check My Puzzle inert (DenButton drops onClick while disabled)', () => {
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    fireEvent.click(gridCell(1, 1))
    checkPuzzle()
    expect(screen.queryByText(/Solvable/)).toBeNull()
  })

  it('reports a solvable board with its assessed difficulty, and shows the solution preview', () => {
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()

    expect(screen.getByText(/Solvable! Assessed difficulty: Easy/)).toBeTruthy()
    expect(screen.getByText("Here's a solution:")).toBeTruthy()
    expect(screen.getByRole('group', { name: /Pathfinder board/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('reports not solvable for two isolated dots with no shared edge, and hides Play/Save', () => {
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    fireEvent.click(gridCell(1, 1))
    fireEvent.click(gridCell(4, 4))
    checkPuzzle()
    expect(screen.getByText(/Not solvable yet/)).toBeTruthy()
    expect(screen.queryByText("Here's a solution:")).toBeNull()
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
  })

  it('toggling a cell after checking clears the stale result', () => {
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    expect(screen.getByText(/Solvable!/)).toBeTruthy()

    fireEvent.click(gridCell(3, 3))
    expect(screen.queryByText(/Solvable!/)).toBeNull()
  })

  it('My Maps button calls onViewMyMaps', () => {
    const onViewMyMaps = vi.fn()
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={onViewMyMaps} />)
    fireEvent.click(screen.getByRole('button', { name: 'My Maps' }))
    expect(onViewMyMaps).toHaveBeenCalledTimes(1)
  })

  it('Play hands the built puzzle to onPlay without requiring a save first', async () => {
    const onPlay = vi.fn()
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={onPlay} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onPlay.mock.calls[0][0].dots).toHaveLength(4)
    expect(await listCustomMaps(PROFILE_ID)).toEqual([]) // Play alone must not persist anything
  })

  it('Save prompts for a name (pre-filled with the auto-incrementing default) and persists on confirm', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('mia_map1')
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/Saved as "mia_map1"/)).toBeTruthy()
    expect(promptSpy).toHaveBeenCalledWith('Name your map:', 'mia_map1')
    const saved = await listCustomMaps(PROFILE_ID)
    expect(saved).toHaveLength(1)
    expect(saved[0].puzzle.name).toBe('mia_map1')
    expect(saved[0].puzzle.difficulty).toBe('easy')
  })

  it('cancelling the Save name prompt (returns null) does not persist anything', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null)
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(promptSpy).toHaveBeenCalled())
    expect(await listCustomMaps(PROFILE_ID)).toEqual([])
  })

  it('a blank name in the prompt falls back to the suggested default instead of saving untitled', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('   ')
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/Saved as/)
    expect((await listCustomMaps(PROFILE_ID))[0].puzzle.name).toBe('mia_map1')
  })

  it('saving twice suggests the next number each time', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValueOnce('mia_map1').mockReturnValueOnce('mia_map2')
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/Saved as "mia_map1"/)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/Saved as "mia_map2"/)

    expect(promptSpy).toHaveBeenNthCalledWith(1, 'Name your map:', 'mia_map1')
    expect(promptSpy).toHaveBeenNthCalledWith(2, 'Name your map:', 'mia_map2')
    expect(await listCustomMaps(PROFILE_ID)).toHaveLength(2)
  })

  it('suggests the next number based on maps already saved to this profile', async () => {
    api.maps.push({ id: 'custom-x', profile_id: PROFILE_ID, name: 'mia_map4', difficulty: 'easy', rows: 1, columns: 1, dots: [{ row: 0, col: 0 }], created_at: '2026-01-01T00:00:00Z' })
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null)
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(promptSpy).toHaveBeenCalledWith('Name your map:', 'mia_map5'))
  })

  it('tells the player when saving fails', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('mia_map1')
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    checkPuzzle()
    api.failing = true
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/Couldn't save your map/)).toBeTruthy()
  })

  it('Clear Grid empties every placed dot', () => {
    render(<PathfinderEditor profileId={PROFILE_ID} username="mia" onPlay={vi.fn()} onViewMyMaps={vi.fn()} />)
    place2x2Square()
    expect(screen.getByText('4 dots placed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear Grid' }))
    expect(screen.getByText('0 dots placed')).toBeTruthy()
  })
})
