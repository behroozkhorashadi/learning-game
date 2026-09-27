import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { PathfinderMyMaps } from './PathfinderMyMaps'
import { installFakePathfinderApi, type FakePathfinderApi } from '../lib/fakePathfinderApi'
import { listCustomMaps, saveCustomMap } from '../lib/pathfinderCustomMaps'
import type { DotPuzzle } from '../lib/pathfinderTypes'

const PROFILE_ID = 1
let api: FakePathfinderApi

beforeEach(() => {
  api = installFakePathfinderApi()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function makePuzzle(id: string, name: string, difficulty: DotPuzzle['difficulty'] = 'easy'): DotPuzzle {
  return {
    id,
    name,
    difficulty,
    rows: 2,
    columns: 2,
    dots: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 0 },
    ],
  }
}

function renderMyMaps(overrides: { onBack?: () => void; onPlay?: (p: DotPuzzle) => void } = {}) {
  render(<PathfinderMyMaps profileId={PROFILE_ID} onBack={overrides.onBack ?? vi.fn()} onPlay={overrides.onPlay ?? vi.fn()} />)
}

describe('PathfinderMyMaps', () => {
  it('shows an empty state when nothing has been saved', async () => {
    renderMyMaps()
    expect(await screen.findByText(/No saved maps yet/)).toBeTruthy()
  })

  it('lists a saved map with its name, dot count, and difficulty tier', async () => {
    await saveCustomMap(PROFILE_ID, makePuzzle('custom-1', 'My First Map', 'medium'))
    renderMyMaps()
    expect(await screen.findByText('My First Map')).toBeTruthy()
    expect(screen.getByText('Medium')).toBeTruthy()
    expect(screen.getByText(/4 dots/)).toBeTruthy()
  })

  it("only shows this profile's maps", async () => {
    await saveCustomMap(2, makePuzzle('custom-other', "Someone Else's Map"))
    renderMyMaps()
    expect(await screen.findByText(/No saved maps yet/)).toBeTruthy()
  })

  it('lists maps most-recently-created first', async () => {
    await saveCustomMap(PROFILE_ID, makePuzzle('custom-1', 'Oldest'))
    await saveCustomMap(PROFILE_ID, makePuzzle('custom-2', 'Newest'))
    renderMyMaps()
    await screen.findByText('Newest')
    const names = screen.getAllByText(/Oldest|Newest/).map((el) => el.textContent)
    expect(names).toEqual(['Newest', 'Oldest'])
  })

  it("Play calls onPlay with that map's puzzle", async () => {
    const onPlay = vi.fn()
    await saveCustomMap(PROFILE_ID, makePuzzle('custom-1', 'Playable'))
    renderMyMaps({ onPlay })
    fireEvent.click(await screen.findByRole('button', { name: 'Play' }))
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onPlay.mock.calls[0][0].id).toBe('custom-1')
  })

  it('Rename prompts, saves, and updates the displayed name', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Renamed Map')
    await saveCustomMap(PROFILE_ID, makePuzzle('custom-1', 'Old Name'))
    renderMyMaps()
    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }))
    expect(await screen.findByText('Renamed Map')).toBeTruthy()
    expect((await listCustomMaps(PROFILE_ID))[0].puzzle.name).toBe('Renamed Map')
  })

  it('cancelling Rename (prompt returns null) leaves the name unchanged', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    await saveCustomMap(PROFILE_ID, makePuzzle('custom-1', 'Original'))
    renderMyMaps()
    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }))
    expect(screen.getByText('Original')).toBeTruthy()
  })

  it('Publish toggles to Unpublish and shows a Published badge', async () => {
    await saveCustomMap(PROFILE_ID, makePuzzle('custom-1', 'Shareable'))
    renderMyMaps()
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Published')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeTruthy()
    expect((await listCustomMaps(PROFILE_ID))[0].published).toBe(true)
  })

  it('Export Code reveals the level snippet, and Hide Code collapses it again', async () => {
    await saveCustomMap(PROFILE_ID, makePuzzle('custom-1', 'Exportable'))
    renderMyMaps()
    fireEvent.click(await screen.findByRole('button', { name: 'Export Code' }))
    const textarea = screen.getByLabelText(/Exported level code/) as HTMLTextAreaElement
    expect(textarea.value).toContain("name: 'Exportable'")

    fireEvent.click(screen.getByRole('button', { name: 'Hide Code' }))
    expect(screen.queryByLabelText(/Exported level code/)).toBeNull()
  })

  it('Delete asks for confirmation and keeps the map when declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await saveCustomMap(PROFILE_ID, makePuzzle('custom-1', 'Keep Me'))
    renderMyMaps()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Keep Me')).toBeTruthy()
    expect(await listCustomMaps(PROFILE_ID)).toHaveLength(1)
  })

  it('Delete removes the map when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await saveCustomMap(PROFILE_ID, makePuzzle('custom-1', 'Remove Me'))
    renderMyMaps()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('Remove Me')).toBeNull())
    expect(await listCustomMaps(PROFILE_ID)).toHaveLength(0)
  })

  it('says so when the maps cannot be loaded', async () => {
    api.failing = true
    renderMyMaps()
    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn't load your maps/)
  })

  it('Back to Builder calls onBack', () => {
    const onBack = vi.fn()
    renderMyMaps({ onBack })
    fireEvent.click(screen.getByRole('button', { name: 'Back to Builder' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
