import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { Pathfinder } from './Pathfinder'
import { installFakePathfinderApi, type FakePathfinderApi } from '../lib/fakePathfinderApi'
import { ALL_LEVELS } from '../lib/pathfinderLevels'
import { solvePuzzle } from '../lib/pathfinderSolver'
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
 * Progress is saved to the server per profile id — here an in-memory fake
 * API, reset before each test so levels start locked/unlocked exactly as a
 * fresh player would see them, and each test uses its own profile id to
 * avoid cross-test bleed even without resetting (defense in depth).
 */

let nextProfileId = 1000
function freshProfileId(): number {
  nextProfileId += 1
  return nextProfileId
}

let api: FakePathfinderApi

beforeEach(() => {
  api = installFakePathfinderApi()
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

/** Renders the game and waits for saved progress to load and the level
 * map to appear. */
async function renderGame(props: { profileId: number; onBack: () => void }) {
  const result = render(<Pathfinder {...props} />)
  await screen.findByText(/maps completed/)
  return result
}

function openFirstLevel(): void {
  const first = ALL_LEVELS[0]
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${first.name}(,|$)`) }))
}

function findOffLineDot(puzzle: DotPuzzle, from: GridPosition): GridPosition {
  const found = puzzle.dots.find(
    (d) => d.row !== from.row && d.col !== from.col,
  )
  if (!found) throw new Error('test fixture assumption broken: expected a non-adjacent dot to exist')
  return found
}

describe('Pathfinder level select', () => {
  it('shows the map first, with only the first level unlocked for a fresh profile', async () => {
    await renderGame({ profileId: freshProfileId(), onBack: vi.fn() })
    expect(screen.getByText(`0 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
    expect(screen.getByRole('button', { name: new RegExp(`^${ALL_LEVELS[0].name}(,|$)`) })).toBeTruthy()
    // A later level is present but locked — its accessible name says so.
    const later = ALL_LEVELS[ALL_LEVELS.length - 1]
    const lockedCard = screen.getByRole('button', { name: new RegExp(`^${later.name}, locked$`) })
    expect((lockedCard as HTMLButtonElement).disabled).toBe(true)
  })

  it('clicking an unlocked level starts play on that level', async () => {
    await renderGame({ profileId: freshProfileId(), onBack: vi.fn() })
    openFirstLevel()
    expect(screen.getByText(progressText(0, ALL_LEVELS[0].dots.length))).toBeTruthy()
  })

  it("the Back button returns to the map from play, and leaves the game entirely from the map", async () => {
    const onBack = vi.fn()
    await renderGame({ profileId: freshProfileId(), onBack })
    openFirstLevel()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText(`0 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
    expect(onBack).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('Build Your Own Map opens the builder, and Back from there returns to the map', async () => {
    await renderGame({ profileId: freshProfileId(), onBack: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /Build Your Own Map/ }))
    // The builder's own grid-cell controls are now on screen.
    expect(screen.getByRole('button', { name: 'Check My Puzzle' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText(`0 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
  })
})

describe('Pathfinder gameplay', () => {
  const level = ALL_LEVELS[0]
  const solution = solvePuzzle(level).path!
  const total = level.dots.length

  async function setup() {
    await renderGame({ profileId: freshProfileId(), onBack: vi.fn() })
    openFirstLevel()
  }

  it('lets the player pick any dot as the start, then extends via adjacent clicks', async () => {
    await setup()
    click(solution[0])
    expect(screen.getByText(progressText(1, total))).toBeTruthy()
    click(solution[1])
    expect(screen.getByText(progressText(2, total))).toBeTruthy()
  })

  it('ignores a non-adjacent click and leaves the path untouched', async () => {
    await setup()
    click(solution[0])
    click(findOffLineDot(level, solution[0]))
    expect(screen.getByText(progressText(1, total))).toBeTruthy()
    expect(screen.getByText(/Only in a straight line/)).toBeTruthy()
  })

  it('ignores a click back on an already-visited dot', async () => {
    await setup()
    click(solution[0])
    click(solution[1])
    click(solution[0]) // revisit
    expect(screen.getByText(progressText(2, total))).toBeTruthy()
    expect(screen.getByText(/already used/)).toBeTruthy()
  })

  it('Undo removes exactly the last move, then goes inert once the path is empty', async () => {
    await setup()
    click(solution[0])
    click(solution[1])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText(progressText(1, total))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText(progressText(0, total))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' })) // nothing left to undo
    expect(screen.getByText(progressText(0, total))).toBeTruthy()
  })

  it('Restart clears the whole path back to untouched', async () => {
    await setup()
    click(solution[0])
    click(solution[1])
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getByText(progressText(0, total))).toBeTruthy()
  })

  it('detects completion once every dot on the level is visited, and unlocks the next level', async () => {
    await setup()
    for (const pos of solution) click(pos)
    expect(screen.getByText(progressText(total, total))).toBeTruthy()
    expect(screen.getByText(/Every dot connected/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back to Map' }))
    expect(screen.getByText(`1 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
    const secondLevel = ALL_LEVELS[1]
    const card = screen.getByRole('button', { name: new RegExp(`^${secondLevel.name}(,|$)`) })
    expect((card as HTMLButtonElement).disabled).toBe(false)
  })

  it('blocks further moves once the puzzle is complete', async () => {
    await setup()
    for (const pos of solution) click(pos)
    expect(screen.getByText(progressText(total, total))).toBeTruthy()
    click(solution[solution.length - 1])
    expect(screen.getByText(progressText(total, total))).toBeTruthy()
  })

  it('Undo after completion un-completes the puzzle by exactly one move', async () => {
    await setup()
    for (const pos of solution) click(pos)
    expect(screen.getByText(progressText(total, total))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText(progressText(total - 1, total))).toBeTruthy()
  })

  it('Next Level advances straight into the newly unlocked level', async () => {
    await setup()
    for (const pos of solution) click(pos)
    fireEvent.click(screen.getByRole('button', { name: 'Next Level' }))
    const secondLevel = ALL_LEVELS[1]
    expect(screen.getByText(progressText(0, secondLevel.dots.length))).toBeTruthy()
  })
})

describe('Pathfinder progress persistence', () => {
  it('a completed level stays unlocked and marked done after leaving and reopening the game', async () => {
    const profileId = freshProfileId()
    const level = ALL_LEVELS[0]
    const solution = solvePuzzle(level).path!

    const { unmount } = await renderGame({ profileId, onBack: vi.fn() })
    openFirstLevel()
    for (const pos of solution) click(pos)
    unmount()

    await renderGame({ profileId, onBack: vi.fn() })
    expect(screen.getByText(`1 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
    const card = screen.getByRole('button', { name: new RegExp(`^${level.name}, completed$`) })
    expect((card as HTMLButtonElement).disabled).toBe(false)
  })

  it("one profile's progress does not unlock levels for a different profile", async () => {
    const profileA = freshProfileId()
    const profileB = freshProfileId()
    const level = ALL_LEVELS[0]
    const solution = solvePuzzle(level).path!

    const { unmount } = await renderGame({ profileId: profileA, onBack: vi.fn() })
    openFirstLevel()
    for (const pos of solution) click(pos)
    unmount()

    await renderGame({ profileId: profileB, onBack: vi.fn() })
    expect(screen.getByText(`0 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
  })

  it('saves a finished level to the server under that profile', async () => {
    const profileId = freshProfileId()
    const level = ALL_LEVELS[0]
    await renderGame({ profileId, onBack: vi.fn() })
    openFirstLevel()
    for (const pos of solvePuzzle(level).path!) click(pos)
    await waitFor(() => expect(api.completions.get(profileId)).toEqual([level.id]))
  })

  it('says so when progress cannot be loaded', async () => {
    api.failing = true
    render(<Pathfinder profileId={freshProfileId()} onBack={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn't load your progress/)
  })

  it('keeps the unlock for this visit but warns when saving a finished level fails', async () => {
    const level = ALL_LEVELS[0]
    await renderGame({ profileId: freshProfileId(), onBack: vi.fn() })
    openFirstLevel()
    api.failing = true
    for (const pos of solvePuzzle(level).path!) click(pos)
    fireEvent.click(screen.getByRole('button', { name: 'Back to Map' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn't save your progress/)
    expect(screen.getByText(`1 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
  })
})

describe('Pathfinder published maps', () => {
  // Any curated level's layout is a known-solvable board to publish.
  const layout = ALL_LEVELS[0]

  function publish(id: string, name: string, authorId: number, published = true) {
    api.maps.push({
      id,
      name,
      profile_id: authorId,
      difficulty: layout.difficulty,
      rows: layout.rows,
      columns: layout.columns,
      dots: layout.dots.map((d) => ({ ...d })),
      published,
      created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, api.maps.length)).toISOString(),
    })
  }

  async function openPublished() {
    fireEvent.click(screen.getByRole('button', { name: /Published Maps/ }))
    await screen.findByText(/maps played/)
  }

  it("lists other players' published maps with their author, leaving out unpublished ones", async () => {
    api.profileNames.set(7, 'Sam')
    publish('custom-shared', 'Sam Spiral', 7)
    publish('custom-draft', 'Sam Draft', 7, false)
    await renderGame({ profileId: freshProfileId(), onBack: vi.fn() })
    await openPublished()

    expect(screen.getByRole('button', { name: /^Sam Spiral/ }).textContent).toMatch(/by Sam/)
    expect(screen.queryByText('Sam Draft')).toBeNull()
    expect(screen.getByText('0 / 1 maps played')).toBeTruthy()
  })

  it('plays a published map, saves it as played, and shows a check mark back on the list', async () => {
    const profileId = freshProfileId()
    publish('custom-play-me', 'Loop', 7)
    await renderGame({ profileId, onBack: vi.fn() })
    await openPublished()

    fireEvent.click(screen.getByRole('button', { name: /^Loop/ }))
    for (const pos of solvePuzzle(layout).path!) click(pos)
    expect(screen.queryByRole('button', { name: 'Next Level' })).toBeNull()
    await waitFor(() => expect(api.completions.get(profileId)).toEqual(['custom-play-me']))

    fireEvent.click(screen.getByRole('button', { name: 'Back to Published Maps' }))
    expect(await screen.findByRole('button', { name: 'Loop, played' })).toBeTruthy()
    expect(screen.getByText('1 / 1 maps played')).toBeTruthy()
  })

  it('drops a map from the list once it is unpublished', async () => {
    publish('custom-short-lived', 'Blink', 7)
    publish('custom-stays', 'Steady', 7)
    await renderGame({ profileId: freshProfileId(), onBack: vi.fn() })
    await openPublished()
    expect(screen.getByRole('button', { name: /^Blink/ })).toBeTruthy()

    api.maps.find((m) => m.id === 'custom-short-lived')!.published = false
    fireEvent.focus(window)

    await waitFor(() => expect(screen.queryByRole('button', { name: /^Blink/ })).toBeNull())
    expect(screen.getByRole('button', { name: /^Steady/ })).toBeTruthy()
  })

  it('does not count played published maps toward curated level progress', async () => {
    const profileId = freshProfileId()
    api.completions.set(profileId, ['custom-something'])
    await renderGame({ profileId, onBack: vi.fn() })
    expect(screen.getByText(`0 / ${ALL_LEVELS.length} maps completed`)).toBeTruthy()
  })
})
