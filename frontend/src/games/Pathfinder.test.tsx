import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Pathfinder } from './Pathfinder'
import { ALL_LEVELS } from '../lib/pathfinderLevels'
import { solvePuzzle } from '../lib/pathfinderSolver'
import { isOrthogonallyAdjacent } from '../lib/pathfinderRules'
import type { DotPuzzle, GridPosition } from '../lib/pathfinderTypes'

/**
 * Drives the game through the real level-select -> play flow with real
 * pointer/click events, rather than reaching into component internals.
 *
 * Levels are hand-authored content that keeps changing (sizes, shapes,
 * count, order), so these tests don't hardcode any level's coordinates or
 * assume which one is "first" beyond `ALL_LEVELS[0]` (which the unlock
 * system guarantees is always playable) — instead they ask the solver for
 * an actual valid path through whichever level is under test and drive the
 * UI along it. That's the same solver already used to validate the levels
 * themselves, so a test relying on it is exactly as trustworthy as the
 * content it's testing.
 *
 * Progress persists in localStorage per profile id — cleared before each
 * test so levels start locked/unlocked exactly as a fresh player would see
 * them, and each test uses its own profile id to avoid cross-test bleed
 * even without clearing (defense in depth).
 */

let nextProfileId = 1000
function freshProfileId(): number {
  nextProfileId += 1
  return nextProfileId
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

function dotButton(pos: GridPosition): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`row ${pos.row + 1}, column ${pos.col + 1}(,|$)`) })
}

function click(pos: GridPosition) {
  fireEvent.pointerUp(dotButton(pos))
}

function progressText(visited: number, total: number): string {
  return `${visited} / ${total} dots connected`
}

function openFirstLevel(): void {
  const first = ALL_LEVELS[0]
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${first.name}(,|$)`) }))
}

function findNonAdjacentDot(puzzle: DotPuzzle, from: GridPosition): GridPosition {
  const found = puzzle.dots.find(
    (d) => !(d.row === from.row && d.col === from.col) && !isOrthogonallyAdjacent(from, d),
  )
  if (!found) throw new Error('test fixture assumption broken: expected a non-adjacent dot to exist')
  return found
}

describe('Pathfinder level select', () => {
  it('shows the map first, with only the first level unlocked for a fresh profile', () => {
    render(<Pathfinder profileId={freshProfileId()} onBack={vi.fn()} />)
    expect(screen.getByText(`0 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
    expect(screen.getByRole('button', { name: new RegExp(`^${ALL_LEVELS[0].name}(,|$)`) })).toBeTruthy()
    // A later level is present but locked — its accessible name says so.
    const later = ALL_LEVELS[ALL_LEVELS.length - 1]
    const lockedCard = screen.getByRole('button', { name: new RegExp(`^${later.name}, locked$`) })
    expect((lockedCard as HTMLButtonElement).disabled).toBe(true)
  })

  it('clicking an unlocked level starts play on that level', () => {
    render(<Pathfinder profileId={freshProfileId()} onBack={vi.fn()} />)
    openFirstLevel()
    expect(screen.getByText(progressText(0, ALL_LEVELS[0].dots.length))).toBeTruthy()
  })

  it("the Back button returns to the map from play, and leaves the game entirely from the map", () => {
    const onBack = vi.fn()
    render(<Pathfinder profileId={freshProfileId()} onBack={onBack} />)
    openFirstLevel()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText(`0 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
    expect(onBack).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('Pathfinder gameplay', () => {
  const level = ALL_LEVELS[0]
  const solution = solvePuzzle(level).path!
  const total = level.dots.length

  function setup() {
    render(<Pathfinder profileId={freshProfileId()} onBack={vi.fn()} />)
    openFirstLevel()
  }

  it('lets the player pick any dot as the start, then extends via adjacent clicks', () => {
    setup()
    click(solution[0])
    expect(screen.getByText(progressText(1, total))).toBeTruthy()
    click(solution[1])
    expect(screen.getByText(progressText(2, total))).toBeTruthy()
  })

  it('ignores a non-adjacent click and leaves the path untouched', () => {
    setup()
    click(solution[0])
    click(findNonAdjacentDot(level, solution[0]))
    expect(screen.getByText(progressText(1, total))).toBeTruthy()
    expect(screen.getByText(/Only straight to a neighbor/)).toBeTruthy()
  })

  it('ignores a click back on an already-visited dot', () => {
    setup()
    click(solution[0])
    click(solution[1])
    click(solution[0]) // revisit
    expect(screen.getByText(progressText(2, total))).toBeTruthy()
    expect(screen.getByText(/already used/)).toBeTruthy()
  })

  it('Undo removes exactly the last move, then goes inert once the path is empty', () => {
    setup()
    click(solution[0])
    click(solution[1])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText(progressText(1, total))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText(progressText(0, total))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' })) // nothing left to undo
    expect(screen.getByText(progressText(0, total))).toBeTruthy()
  })

  it('Restart clears the whole path back to untouched', () => {
    setup()
    click(solution[0])
    click(solution[1])
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getByText(progressText(0, total))).toBeTruthy()
  })

  it('detects completion once every dot on the level is visited, and unlocks the next level', () => {
    setup()
    for (const pos of solution) click(pos)
    expect(screen.getByText(progressText(total, total))).toBeTruthy()
    expect(screen.getByText(/Every dot connected/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back to Map' }))
    expect(screen.getByText(`1 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
    const secondLevel = ALL_LEVELS[1]
    const card = screen.getByRole('button', { name: new RegExp(`^${secondLevel.name}(,|$)`) })
    expect((card as HTMLButtonElement).disabled).toBe(false)
  })

  it('blocks further moves once the puzzle is complete', () => {
    setup()
    for (const pos of solution) click(pos)
    expect(screen.getByText(progressText(total, total))).toBeTruthy()
    click(solution[solution.length - 1])
    expect(screen.getByText(progressText(total, total))).toBeTruthy()
  })

  it('Undo after completion un-completes the puzzle by exactly one move', () => {
    setup()
    for (const pos of solution) click(pos)
    expect(screen.getByText(progressText(total, total))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText(progressText(total - 1, total))).toBeTruthy()
  })

  it('Next Level advances straight into the newly unlocked level', () => {
    setup()
    for (const pos of solution) click(pos)
    fireEvent.click(screen.getByRole('button', { name: 'Next Level' }))
    const secondLevel = ALL_LEVELS[1]
    expect(screen.getByText(progressText(0, secondLevel.dots.length))).toBeTruthy()
  })
})

describe('Pathfinder progress persistence', () => {
  it('a completed level stays unlocked and marked done after leaving and reopening the game', () => {
    const profileId = freshProfileId()
    const level = ALL_LEVELS[0]
    const solution = solvePuzzle(level).path!

    const { unmount } = render(<Pathfinder profileId={profileId} onBack={vi.fn()} />)
    openFirstLevel()
    for (const pos of solution) click(pos)
    unmount()

    render(<Pathfinder profileId={profileId} onBack={vi.fn()} />)
    expect(screen.getByText(`1 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
    const card = screen.getByRole('button', { name: new RegExp(`^${level.name}, completed$`) })
    expect((card as HTMLButtonElement).disabled).toBe(false)
  })

  it("one profile's progress does not unlock levels for a different profile", () => {
    const profileA = freshProfileId()
    const profileB = freshProfileId()
    const level = ALL_LEVELS[0]
    const solution = solvePuzzle(level).path!

    const { unmount } = render(<Pathfinder profileId={profileA} onBack={vi.fn()} />)
    openFirstLevel()
    for (const pos of solution) click(pos)
    unmount()

    render(<Pathfinder profileId={profileB} onBack={vi.fn()} />)
    expect(screen.getByText(`0 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
  })
})
