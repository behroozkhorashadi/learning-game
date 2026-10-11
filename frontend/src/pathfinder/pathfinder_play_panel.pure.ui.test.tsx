import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { PathfinderPlayPanel } from './pathfinder_play_panel.pure.ui.tsx'
import type { PathfinderPlayState } from './use_pathfinder_play.pure.hook.ts'

afterEach(cleanup)

function playState(overrides: Partial<PathfinderPlayState> = {}): PathfinderPlayState {
  return {
    path: [],
    completed: false,
    progress: { visited: 0, total: 4 },
    invalidReason: null,
    stuck: false,
    canUndo: false,
    canRestart: false,
    handleDotClick: vi.fn(),
    handleUndo: vi.fn(),
    handleRestart: vi.fn(),
    ...overrides,
  }
}

function renderPanel(play: PathfinderPlayState): void {
  render(<PathfinderPlayPanel puzzle={squarePuzzle('p')} title="Loop" play={play} completeMessage="Done! 🎉" actions={<button type="button">Extra</button>} />)
}

describe('PathfinderPlayPanel', () => {
  it('shows the title, progress, and the caller-supplied actions before Undo and Restart', () => {
    renderPanel(playState())
    expect(screen.getByText('Loop')).toBeTruthy()
    expect(screen.getByText('0 / 4 dots connected')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Extra|Undo|Restart/ }).map((b) => b.textContent)).toEqual(['Extra', 'Undo', 'Restart'])
  })

  it('shows the invalid-move reason in preference to the stuck hint', () => {
    renderPanel(playState({ invalidReason: "There's no dot there.", stuck: true }))
    expect(screen.getByText("There's no dot there.")).toBeTruthy()
    expect(screen.queryByText(/No legal move/)).toBeNull()
  })

  it('shows the stuck hint and wires Undo / Restart when there is a path', () => {
    const play = playState({ stuck: true, canUndo: true, canRestart: true, path: [{ row: 0, col: 0 }] })
    renderPanel(play)
    expect(screen.getByText('No legal move from here — try Undo or Restart.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect([vi.mocked(play.handleUndo).mock.calls.length, vi.mocked(play.handleRestart).mock.calls.length]).toEqual([1, 1])
  })

  it('shows the completion message once complete', () => {
    renderPanel(playState({ completed: true, progress: { visited: 4, total: 4 } }))
    expect(screen.getByText('Done! 🎉')).toBeTruthy()
  })
})
