import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedMap, squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { fakePathfinderScreens, type FakePathfinderScreens } from './pathfinder_screens.test.ui.tsx'
import type { DotPuzzle } from './pathfinder_state.pure.lib.ts'

const PROFILE_ID = 1
let screens: FakePathfinderScreens

beforeEach(() => {
  screens = fakePathfinderScreens()
})

afterEach(cleanup)

const seed = (id: string, name: string, difficulty: DotPuzzle['difficulty'] = 'easy', profileId = PROFILE_ID): Promise<void> => seedMap(screens.server, profileId, { ...squarePuzzle(id, name), difficulty })

function renderMyMaps(onPlay: (p: DotPuzzle) => void = vi.fn(), onBack: () => void = vi.fn()): void {
  render(<screens.MyMaps profileId={PROFILE_ID} onBack={onBack} onPlay={onPlay} />)
}

describe('PathfinderMyMaps', () => {
  it('shows a loading state, then an empty state when nothing has been saved', async () => {
    renderMyMaps()
    expect(screen.getByText('Loading maps…')).toBeTruthy()
    expect(await screen.findByText(/No saved maps yet/)).toBeTruthy()
  })

  it('lists a saved map with its name, dot count, date, and difficulty tier', async () => {
    await seed('custom-1', 'My First Map', 'medium')
    renderMyMaps()
    expect(await screen.findByText('My First Map')).toBeTruthy()
    expect(screen.getByText('Medium')).toBeTruthy()
    // The date is shown in the viewer's locale and timezone; only assert that one is there.
    expect(screen.getByText(/^4 dots · \S+ \d+, \d{4}$/)).toBeTruthy()
  })

  it("only shows this profile's maps", async () => {
    await seed('custom-other', "Someone Else's Map", 'easy', 2)
    renderMyMaps()
    expect(await screen.findByText(/No saved maps yet/)).toBeTruthy()
  })

  it('lists maps most-recently-created first', async () => {
    await seed('custom-1', 'Oldest')
    await seed('custom-2', 'Newest')
    renderMyMaps()
    await screen.findByText('Newest')
    const rows = within(screen.getByRole('list', { name: 'Saved maps' })).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent.includes('Newest'))).toEqual([true, false])
  })

  it("Play calls onPlay with that map's puzzle", async () => {
    const played: DotPuzzle[] = []
    await seed('custom-1', 'Playable')
    renderMyMaps((p) => {
      played.push(p)
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Play Playable' }))
    expect(played.map((p) => p.id)).toEqual(['custom-1'])
  })

  it('Rename prompts with the current name, saves, and shows the new name', async () => {
    screens.dialogs.prompts.push('  Renamed Map ')
    await seed('custom-1', 'Old Name')
    renderMyMaps()
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Old Name' }))
    expect(await screen.findByText('Renamed Map')).toBeTruthy()
    expect(screens.dialogs.shown).toEqual(['Rename map:'])
    expect(screens.server.maps()[0]?.puzzle.name).toBe('Renamed Map')
  })

  it('cancelling Rename, or entering the same or a blank name, changes nothing', async () => {
    screens.dialogs.prompts.push(null, 'Original', '  ')
    await seed('custom-1', 'Original')
    renderMyMaps()
    for (let i = 0; i < 3; i++) fireEvent.click(await screen.findByRole('button', { name: 'Rename Original' }))
    expect(screens.server.calls('renameMap')).toBe(0)
  })

  it('Publish toggles to Unpublish and shows a Published badge', async () => {
    await seed('custom-1', 'Shareable')
    renderMyMaps()
    fireEvent.click(await screen.findByRole('button', { name: 'Publish Shareable' }))
    expect(await screen.findByText('Published')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Unpublish Shareable' })).toBeTruthy()
    expect(screens.server.maps()[0]?.published).toBe(true)
  })

  it('Export Code reveals the level snippet, and Hide Code collapses it again', async () => {
    await seed('custom-1', 'Exportable')
    renderMyMaps()
    fireEvent.click(await screen.findByRole('button', { name: 'Export code for Exportable' }))
    expect(screen.getByLabelText('Exported level code for Exportable')).toHaveProperty('value', expect.stringContaining("name: 'Exportable'"))

    fireEvent.click(screen.getByRole('button', { name: 'Hide code for Exportable' }))
    expect(screen.queryByLabelText(/Exported level code/)).toBeNull()
  })

  it('Delete asks for confirmation and keeps the map when declined', async () => {
    screens.dialogs.confirms.push(false)
    await seed('custom-1', 'Keep Me')
    renderMyMaps()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Keep Me' }))
    expect(screens.dialogs.shown).toEqual(['Delete "Keep Me"? This can\'t be undone.'])
    expect(screen.getByText('Keep Me')).toBeTruthy()
    expect(screens.server.maps()).toHaveLength(1)
  })

  it('Delete removes the map when confirmed', async () => {
    await seed('custom-1', 'Remove Me')
    renderMyMaps()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Remove Me' }))
    await waitFor(() => {
      expect(screen.queryByText('Remove Me')).toBeNull()
    })
    expect(screens.server.maps()).toHaveLength(0)
  })

  it('says why a change failed and keeps the list', async () => {
    await seed('custom-1', 'Stubborn')
    renderMyMaps()
    await screen.findByText('Stubborn')
    screens.server.failing = true
    fireEvent.click(screen.getByRole('button', { name: 'Publish Stubborn' }))
    expect((await screen.findByRole('alert')).textContent).toBe("Couldn't change that map's published setting.")
    expect(screen.getByText('Stubborn')).toBeTruthy()
  })

  it('says so when the maps cannot be loaded', async () => {
    screens.server.failing = true
    renderMyMaps()
    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn't load your maps/)
  })

  it('Back to Builder calls onBack', () => {
    const onBack = vi.fn()
    renderMyMaps(vi.fn(), onBack)
    fireEvent.click(screen.getByRole('button', { name: 'Back to Builder' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
