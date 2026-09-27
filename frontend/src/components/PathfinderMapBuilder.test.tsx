import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PathfinderMapBuilder } from './PathfinderMapBuilder'
import { installFakePathfinderApi } from '../lib/fakePathfinderApi'

/**
 * Navigation-only tests — the three screens' own content/behavior is
 * covered by PathfinderEditor.test.tsx, PathfinderMyMaps.test.tsx, and
 * PathfinderPlayTest.test.tsx. This just confirms the mode switch wires
 * them together correctly.
 */

beforeEach(() => {
  installFakePathfinderApi()
})

afterEach(cleanup)

function gridCell(row: number, col: number): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`row ${row}, column ${col},`) })
}

describe('PathfinderMapBuilder', () => {
  it('starts on the build screen', () => {
    render(<PathfinderMapBuilder profileId={1} username="mia" />)
    expect(screen.getByRole('button', { name: 'Check My Puzzle' })).toBeTruthy()
  })

  it('My Maps navigates to the library, and Back to Builder returns', async () => {
    render(<PathfinderMapBuilder profileId={1} username="mia" />)
    fireEvent.click(screen.getByRole('button', { name: 'My Maps' }))
    expect(await screen.findByText(/No saved maps yet/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back to Builder' }))
    expect(screen.getByRole('button', { name: 'Check My Puzzle' })).toBeTruthy()
  })

  it('Play from the builder switches to the play-test screen', () => {
    render(<PathfinderMapBuilder profileId={1} username="mia" />)
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
})
