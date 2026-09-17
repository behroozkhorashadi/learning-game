import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PathfinderMyMaps } from './PathfinderMyMaps'
import { listCustomMaps, saveCustomMap } from '../lib/pathfinderCustomMaps'
import type { DotPuzzle } from '../lib/pathfinderTypes'

beforeEach(() => {
  localStorage.clear()
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

describe('PathfinderMyMaps', () => {
  it('shows an empty state when nothing has been saved', () => {
    render(<PathfinderMyMaps onBack={vi.fn()} onPlay={vi.fn()} />)
    expect(screen.getByText(/No saved maps yet/)).toBeTruthy()
  })

  it('lists a saved map with its name, dot count, and difficulty tier', () => {
    saveCustomMap(makePuzzle('custom-1', 'My First Map', 'medium'))
    render(<PathfinderMyMaps onBack={vi.fn()} onPlay={vi.fn()} />)
    expect(screen.getByText('My First Map')).toBeTruthy()
    expect(screen.getByText('Medium')).toBeTruthy()
    expect(screen.getByText(/4 dots/)).toBeTruthy()
  })

  it('lists maps most-recently-created first', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    saveCustomMap(makePuzzle('custom-1', 'Oldest'))
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
    saveCustomMap(makePuzzle('custom-2', 'Newest'))
    vi.useRealTimers()

    render(<PathfinderMyMaps onBack={vi.fn()} onPlay={vi.fn()} />)
    const names = screen.getAllByText(/Oldest|Newest/).map((el) => el.textContent)
    expect(names).toEqual(['Newest', 'Oldest'])
  })

  it('Play calls onPlay with that map\'s puzzle', () => {
    const onPlay = vi.fn()
    saveCustomMap(makePuzzle('custom-1', 'Playable'))
    render(<PathfinderMyMaps onBack={vi.fn()} onPlay={onPlay} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onPlay.mock.calls[0][0].id).toBe('custom-1')
  })

  it('Rename prompts and updates the displayed name', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Renamed Map')
    saveCustomMap(makePuzzle('custom-1', 'Old Name'))
    render(<PathfinderMyMaps onBack={vi.fn()} onPlay={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(screen.getByText('Renamed Map')).toBeTruthy()
    expect(listCustomMaps()[0].puzzle.name).toBe('Renamed Map')
  })

  it('cancelling Rename (prompt returns null) leaves the name unchanged', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    saveCustomMap(makePuzzle('custom-1', 'Original'))
    render(<PathfinderMyMaps onBack={vi.fn()} onPlay={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(screen.getByText('Original')).toBeTruthy()
  })

  it('Publish toggles to Unpublish and shows a Published badge', () => {
    saveCustomMap(makePuzzle('custom-1', 'Shareable'))
    render(<PathfinderMyMaps onBack={vi.fn()} onPlay={vi.fn()} />)
    expect(screen.queryByText('Published')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(screen.getByText('Published')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeTruthy()
    expect(listCustomMaps()[0].published).toBe(true)
  })

  it('Export Code reveals the level snippet, and Hide Code collapses it again', () => {
    saveCustomMap(makePuzzle('custom-1', 'Exportable'))
    render(<PathfinderMyMaps onBack={vi.fn()} onPlay={vi.fn()} />)
    expect(screen.queryByLabelText(/Exported level code/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Export Code' }))
    const textarea = screen.getByLabelText(/Exported level code/) as HTMLTextAreaElement
    expect(textarea.value).toContain("name: 'Exportable'")

    fireEvent.click(screen.getByRole('button', { name: 'Hide Code' }))
    expect(screen.queryByLabelText(/Exported level code/)).toBeNull()
  })

  it('Delete asks for confirmation and removes the map only when confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    saveCustomMap(makePuzzle('custom-1', 'Keep Me'))
    render(<PathfinderMyMaps onBack={vi.fn()} onPlay={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Keep Me')).toBeTruthy()
    expect(listCustomMaps()).toHaveLength(1)
  })

  it('Delete removes the map when confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    saveCustomMap(makePuzzle('custom-1', 'Remove Me'))
    render(<PathfinderMyMaps onBack={vi.fn()} onPlay={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.queryByText('Remove Me')).toBeNull()
    expect(listCustomMaps()).toHaveLength(0)
  })

  it('Back to Builder calls onBack', () => {
    const onBack = vi.fn()
    render(<PathfinderMyMaps onBack={onBack} onPlay={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to Builder' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
