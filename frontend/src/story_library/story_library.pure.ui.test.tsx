import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { CROW, LIGHTHOUSE, library } from './library_fixtures.test.lib.ts'
import { StoryLibraryView, type StoryLibraryViewProps } from './story_library.pure.ui.tsx'

afterEach(cleanup)

function renderView(overrides: Partial<StoryLibraryViewProps> = {}): StoryLibraryViewProps {
  const props: StoryLibraryViewProps = { state: loaded(library([CROW, LIGHTHOUSE])), profileName: 'Mia', error: null, onBack: vi.fn(), onWriteNew: vi.fn(), onDelete: vi.fn(), ...overrides }
  render(<StoryLibraryView {...props} />)
  return props
}

describe('StoryLibraryView', () => {
  it('shows the empty shelf when there are no pieces, and starts the first story', () => {
    const { onWriteNew } = renderView({ state: loaded(library([])) })
    expect(screen.getByText('Your book is waiting for its first story.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Write the first one' }))
    expect(onWriteNew).toHaveBeenCalled()
  })

  it('lists pieces on the shelf with their game and constraint chips', () => {
    renderView()
    expect(screen.getByText('2 stories so far')).toBeTruthy()
    expect(screen.getAllByText('Syllable Builder')).toHaveLength(2)
    expect(screen.getByText('a lighthouse')).toBeTruthy()
  })

  it('opens the reader, steps between stories, and goes back to the shelf', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'The Ninety-Six Steps' }))
    expect(screen.getByText('The lighthouse had been dark for eleven years.')).toBeTruthy()
    expect(screen.getByText('2 / 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next story' }))
    expect(screen.getByText('A crow found a map.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Shelf/ }))
    expect(screen.getByText('2 stories so far')).toBeTruthy()
  })

  it('asks to delete from the shelf and from the reader', () => {
    const { onDelete } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Delete The Crow' }))
    fireEvent.click(screen.getByRole('button', { name: 'The Ninety-Six Steps' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete this story' }))
    expect(vi.mocked(onDelete).mock.calls).toEqual([['p2'], ['p1']])
  })

  it('goes back from the top-level back button', () => {
    const { onBack } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('renders loading, a load failure, and a delete failure', () => {
    renderView({ state: LOADING })
    expect(screen.getByRole('status').textContent).toBe('Loading your storybook…')
    cleanup()
    renderView({ state: failed('GET /api/pieces failed with HTTP 500') })
    expect(screen.getByRole('alert').textContent).toBe('Error: GET /api/pieces failed with HTTP 500')
    cleanup()
    renderView({ error: 'DELETE /api/pieces/p1 failed with HTTP 500' })
    expect(screen.getByRole('alert').textContent).toBe('Error: DELETE /api/pieces/p1 failed with HTTP 500')
  })
})
