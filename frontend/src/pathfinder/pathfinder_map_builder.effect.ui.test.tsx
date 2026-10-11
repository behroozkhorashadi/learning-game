import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { seedMap, squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { fakePathfinderScreens } from './pathfinder_screens.test.ui.tsx'

/**
 * Navigation-only tests — the three screens' own content/behavior is
 * covered by their own tests. This confirms the screen switch wires the
 * injected editor, library, and play-test screens together.
 */

afterEach(cleanup)

function gridCell(row: number, col: number): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`row ${String(row)}, column ${String(col)},`) })
}

function renderBuilder(): ReturnType<typeof fakePathfinderScreens> {
  const screens = fakePathfinderScreens()
  render(<screens.MapBuilder profileId={1} username="mia" />)
  return screens
}

describe('PathfinderMapBuilder', () => {
  it('starts on the build screen', () => {
    renderBuilder()
    expect(screen.getByRole('button', { name: 'Check My Puzzle' })).toBeTruthy()
  })

  it('My Maps navigates to the library, and Back to Builder returns', async () => {
    renderBuilder()
    fireEvent.click(screen.getByRole('button', { name: 'My Maps' }))
    expect(await screen.findByText(/No saved maps yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Builder' }))
    expect(screen.getByRole('button', { name: 'Check My Puzzle' })).toBeTruthy()
  })

  it('Play from the builder switches to the play-test screen, and back', () => {
    renderBuilder()
    fireEvent.click(gridCell(1, 1))
    fireEvent.click(gridCell(1, 2))
    fireEvent.click(gridCell(2, 2))
    fireEvent.click(gridCell(2, 1))
    fireEvent.click(screen.getByRole('button', { name: 'Check My Puzzle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    expect(screen.getByText('0 / 4 dots connected')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Builder' }))
    expect(screen.getByRole('button', { name: 'Check My Puzzle' })).toBeTruthy()
  })

  it('Play on a saved map in My Maps opens it in the play-test screen', async () => {
    const screens = fakePathfinderScreens()
    await seedMap(screens.server, 1, squarePuzzle('custom-1', 'Saved One'))
    render(<screens.MapBuilder profileId={1} username="mia" />)
    fireEvent.click(screen.getByRole('button', { name: 'My Maps' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Play Saved One' }))
    expect(screen.getByText('Saved One')).toBeTruthy()
    expect(screen.getByText('0 / 4 dots connected')).toBeTruthy()
  })
})
