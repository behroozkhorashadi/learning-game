import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedMap } from './pathfinder_fakes.test.lib.ts'
import { ALL_LEVELS } from './pathfinder_levels.pure.lib.ts'
import { fakePathfinderScreens, type FakePathfinderScreens } from './pathfinder_screens.test.ui.tsx'
import { solvePuzzle } from './pathfinder_solver.pure.lib.ts'
import type { DotPuzzle, GridPosition } from './pathfinder_state.pure.lib.ts'

/**
 * Drives the game through the real level-select -> play flow with real
 * pointer/click events, rather than reaching into component internals.
 *
 * Levels are hand-authored content that keeps changing (sizes, shapes,
 * count, order), so these tests don't hardcode any level's coordinates or
 * assume which one is "first" beyond `ALL_LEVELS[0]` (which the unlock
 * system guarantees is always playable) — instead they ask the solver for
 * an actual valid path through whichever level is under test and drive the
 * UI along it.
 *
 * Progress lives on an in-memory fake server bound through the game's
 * bind* seam, fresh for each test.
 */

let screens: FakePathfinderScreens

beforeEach(() => {
  screens = fakePathfinderScreens()
})

afterEach(cleanup)

function level(index: number): DotPuzzle {
  const found = ALL_LEVELS[index]
  if (found === undefined) throw new Error(`needs a curated level at ${String(index)}`)
  return found
}

function solutionOf(puzzle: DotPuzzle): readonly GridPosition[] {
  const path = solvePuzzle(puzzle).path
  if (path === null) throw new Error(`${puzzle.id} should be solvable`)
  return path
}

function at(path: readonly GridPosition[], i: number): GridPosition {
  const pos = path.at(i)
  if (pos === undefined) throw new Error(`no step ${String(i)}`)
  return pos
}

function click(pos: GridPosition): void {
  fireEvent.pointerUp(screen.getByRole('button', { name: new RegExp(`row ${String(pos.row + 1)}, column ${String(pos.col + 1)}(,|$)`) }))
}

const progressText = (visited: number, total: number): string => `${String(visited)} / ${String(total)} dots connected`
const mapsCompleted = (n: number): string => `${String(n)} / ${String(ALL_LEVELS.length)} maps completed`
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const levelCard = (puzzle: DotPuzzle, suffix = '(,|$)'): HTMLElement => screen.getByRole('button', { name: new RegExp(`^${escape(puzzle.name ?? puzzle.id)}${suffix}`) })

/** Renders the game and waits for saved progress to load and the level map to appear. */
async function renderGame(profileId = 1, onBack: () => void = vi.fn()): Promise<{ readonly unmount: () => void }> {
  const result = render(<screens.Pathfinder profileId={profileId} onBack={onBack} />)
  await screen.findByText(/maps completed/)
  return result
}

function openFirstLevel(): void {
  fireEvent.click(levelCard(level(0)))
}

function offLineDot(puzzle: DotPuzzle, from: GridPosition): GridPosition {
  const found = puzzle.dots.find((d) => d.row !== from.row && d.col !== from.col)
  if (found === undefined) throw new Error('test fixture assumption broken: expected a non-adjacent dot to exist')
  return found
}

describe('Pathfinder level select', () => {
  it('shows the map first, with only the first level unlocked for a fresh profile', async () => {
    await renderGame()
    expect(screen.getByText(mapsCompleted(0))).toBeTruthy()
    expect(levelCard(level(0))).toHaveProperty('disabled', false)
    expect(levelCard(level(ALL_LEVELS.length - 1), ', locked$')).toHaveProperty('disabled', true)
  })

  it('clicking an unlocked level starts play on that level', async () => {
    await renderGame()
    openFirstLevel()
    expect(screen.getByText(progressText(0, level(0).dots.length))).toBeTruthy()
  })

  it('the Back button returns to the map from play, and leaves the game entirely from the map', async () => {
    const onBack = vi.fn()
    await renderGame(1, onBack)
    openFirstLevel()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText(mapsCompleted(0))).toBeTruthy()
    expect(onBack).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('Build Your Own Map opens the builder, and Back from there returns to the map', async () => {
    await renderGame()
    fireEvent.click(screen.getByRole('button', { name: /Build Your Own Map/ }))
    expect(screen.getByRole('button', { name: 'Check My Puzzle' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText(mapsCompleted(0))).toBeTruthy()
  })

  it("counts the profile's saved maps on the build card", async () => {
    await seedMap(screens.server, 1, { ...level(0), id: 'custom-a', name: 'Mine' })
    await renderGame()
    expect(await screen.findByText("1 map you've built")).toBeTruthy()
  })
})

describe('Pathfinder gameplay', () => {
  const total = level(0).dots.length
  const solution = solutionOf(level(0))

  async function setup(): Promise<void> {
    await renderGame()
    openFirstLevel()
  }

  it('lets the player pick any dot as the start, then extends via adjacent clicks', async () => {
    await setup()
    click(at(solution, 0))
    expect(screen.getByText(progressText(1, total))).toBeTruthy()
    click(at(solution, 1))
    expect(screen.getByText(progressText(2, total))).toBeTruthy()
  })

  it('ignores a non-adjacent click, says why, and clears the reason after the feedback timer', async () => {
    await setup()
    click(at(solution, 0))
    click(offLineDot(level(0), at(solution, 0)))
    expect(screen.getByText(progressText(1, total))).toBeTruthy()
    expect(screen.getByText(/Only in a straight line/)).toBeTruthy()
    screens.timers.fireAll()
    await waitFor(() => {
      expect(screen.queryByText(/Only in a straight line/)).toBeNull()
    })
  })

  it('ignores a click back on an already-visited dot', async () => {
    await setup()
    click(at(solution, 0))
    click(at(solution, 1))
    click(at(solution, 0))
    expect(screen.getByText(progressText(2, total))).toBeTruthy()
    expect(screen.getByText(/already used/)).toBeTruthy()
  })

  it('Undo removes exactly the last move, then goes inert once the path is empty', async () => {
    await setup()
    click(at(solution, 0))
    click(at(solution, 1))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText(progressText(1, total))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText(progressText(0, total))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText(progressText(0, total))).toBeTruthy()
  })

  it('Restart clears the whole path back to untouched', async () => {
    await setup()
    click(at(solution, 0))
    click(at(solution, 1))
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getByText(progressText(0, total))).toBeTruthy()
  })

  it('detects completion once every dot is visited, and unlocks the next level', async () => {
    await setup()
    for (const pos of solution) click(pos)
    expect(screen.getByText(progressText(total, total))).toBeTruthy()
    expect(screen.getByText(/Every dot connected/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back to Map' }))
    expect(screen.getByText(mapsCompleted(1))).toBeTruthy()
    expect(levelCard(level(1))).toHaveProperty('disabled', false)
  })

  it('blocks further moves once complete, and Undo un-completes by exactly one move', async () => {
    await setup()
    for (const pos of solution) click(pos)
    click(at(solution, -1))
    expect(screen.getByText(progressText(total, total))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText(progressText(total - 1, total))).toBeTruthy()
  })

  it('Next Level advances straight into the newly unlocked level', async () => {
    await setup()
    for (const pos of solution) click(pos)
    fireEvent.click(screen.getByRole('button', { name: 'Next Level' }))
    expect(screen.getByText(progressText(0, level(1).dots.length))).toBeTruthy()
  })
})

describe('Pathfinder progress persistence', () => {
  it('a completed level stays unlocked and marked done after leaving and reopening the game', async () => {
    const { unmount } = await renderGame(5)
    openFirstLevel()
    for (const pos of solutionOf(level(0))) click(pos)
    await waitFor(() => {
      expect(screens.server.completions.get(5)).toEqual([level(0).id])
    })
    unmount()

    await renderGame(5)
    expect(screen.getByText(mapsCompleted(1))).toBeTruthy()
    expect(levelCard(level(0), ', completed$')).toHaveProperty('disabled', false)
  })

  it("one profile's progress does not unlock levels for a different profile", async () => {
    const { unmount } = await renderGame(5)
    openFirstLevel()
    for (const pos of solutionOf(level(0))) click(pos)
    unmount()

    await renderGame(6)
    expect(screen.getByText(mapsCompleted(0))).toBeTruthy()
  })

  it('says so when progress cannot be loaded', async () => {
    screens.server.failing = true
    render(<screens.Pathfinder profileId={1} onBack={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn't load your progress/)
  })

  it('keeps the unlock for this visit but warns when saving a finished level fails', async () => {
    await renderGame()
    openFirstLevel()
    screens.server.failing = true
    for (const pos of solutionOf(level(0))) click(pos)
    fireEvent.click(screen.getByRole('button', { name: 'Back to Map' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn't save your progress/)
    expect(screen.getByText(mapsCompleted(1))).toBeTruthy()
  })

  it('does not count played published maps toward curated level progress', async () => {
    screens.server.completions.set(1, ['custom-something'])
    await renderGame()
    expect(screen.getByText(mapsCompleted(0))).toBeTruthy()
  })
})

describe('Pathfinder published maps', () => {
  // Any curated level's layout is a known-solvable board to publish.
  const layout = level(0)

  async function openPublished(): Promise<void> {
    fireEvent.click(screen.getByRole('button', { name: /Published Maps/ }))
    await screen.findByText(/maps played/)
  }

  it("lists other players' published maps with their author, leaving out unpublished ones", async () => {
    screens.server.profileNames.set(7, 'Sam')
    await seedMap(screens.server, 7, { ...layout, id: 'custom-shared', name: 'Sam Spiral' }, true)
    await seedMap(screens.server, 7, { ...layout, id: 'custom-draft', name: 'Sam Draft' })
    await renderGame()
    await openPublished()

    expect(screen.getByRole('button', { name: /^Sam Spiral/ }).textContent).toMatch(/by Sam/)
    expect(screen.queryByText('Sam Draft')).toBeNull()
    expect(screen.getByText('0 / 1 maps played')).toBeTruthy()
  })

  it('plays a published map, saves it as played, and shows a check mark back on the list', async () => {
    await seedMap(screens.server, 7, { ...layout, id: 'custom-play-me', name: 'Loop' }, true)
    await renderGame(5)
    await openPublished()

    fireEvent.click(screen.getByRole('button', { name: /^Loop/ }))
    for (const pos of solutionOf(layout)) click(pos)
    expect(screen.queryByRole('button', { name: 'Next Level' })).toBeNull()
    await waitFor(() => {
      expect(screens.server.completions.get(5)).toEqual(['custom-play-me'])
    })

    fireEvent.click(screen.getByRole('button', { name: 'Back to Published Maps' }))
    expect(await screen.findByRole('button', { name: 'Loop, played' })).toBeTruthy()
    expect(screen.getByText('1 / 1 maps played')).toBeTruthy()
  })

  it('drops a map from the list once it is unpublished and the window regains focus', async () => {
    await seedMap(screens.server, 7, { ...layout, id: 'custom-short-lived', name: 'Blink' }, true)
    await seedMap(screens.server, 7, { ...layout, id: 'custom-stays', name: 'Steady' }, true)
    await renderGame()
    await openPublished()
    expect(screen.getByRole('button', { name: /^Blink/ })).toBeTruthy()

    await screens.server.setMapPublished(7, 'custom-short-lived', false)
    screens.focus.focus()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Blink/ })).toBeNull()
    })
    expect(screen.getByRole('button', { name: /^Steady/ })).toBeTruthy()
  })

  it('shows your own published map as by you', async () => {
    await seedMap(screens.server, 5, { ...layout, id: 'custom-mine', name: 'Mine' }, true)
    await renderGame(5)
    await openPublished()
    expect(screen.getByRole('button', { name: /^Mine/ }).textContent).toMatch(/by you/)
  })
})

describe('Pathfinder backdrop', () => {
  it("hangs the kid's art behind the game, and leaves the plain background without it", async () => {
    await renderGame()
    expect(screen.queryByRole('img', { name: 'Your backdrop art' })).toBeNull()
    cleanup()
    const hung = fakePathfinderScreens(undefined, '/static/armory-art/a1.jpg')
    render(<hung.Pathfinder profileId={1} onBack={vi.fn()} />)
    await screen.findByText(/maps completed/)
    const art = await screen.findByRole('img', { name: 'Your backdrop art' })
    expect(art.getAttribute('src')).toBe('/static/armory-art/a1.jpg')
  })
})
