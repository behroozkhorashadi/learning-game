import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakePathfinderServer, manualFocus, seedMap, squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { bindPathfinderPublishedMaps } from './pathfinder_published_maps.effect.ui.tsx'
import type { DotPuzzle } from './pathfinder_state.pure.lib.ts'

afterEach(cleanup)

function renderPublished(server = fakePathfinderServer(), completedIds: ReadonlySet<string> = new Set(), onPlay: (p: DotPuzzle) => void = vi.fn()) {
  const focus = manualFocus()
  const PublishedMaps = bindPathfinderPublishedMaps({ listPublishedMaps: server.listPublishedMaps, subscribeToFocus: focus.subscribe })
  const result = render(<PublishedMaps profileId={1} completedIds={completedIds} onPlay={onPlay} />)
  return { ...result, focus, server }
}

describe('PathfinderPublishedMaps', () => {
  it('shows loading, then an empty state', async () => {
    renderPublished()
    expect(screen.getByText('Loading maps…')).toBeTruthy()
    expect(await screen.findByText(/No published maps yet/)).toBeTruthy()
  })

  it('lists maps with author, tier, and played state, and plays the one clicked', async () => {
    const server = fakePathfinderServer()
    server.profileNames.set(7, 'Sam')
    await seedMap(server, 7, { ...squarePuzzle('custom-a', 'Spiral'), difficulty: 'hard' }, true)
    await seedMap(server, 1, squarePuzzle('custom-b', 'Mine'), true)
    const played: DotPuzzle[] = []
    renderPublished(server, new Set(['custom-a']), (p) => {
      played.push(p)
    })

    const spiral = await screen.findByRole('button', { name: 'Spiral, played' })
    expect(spiral.textContent).toMatch(/by Sam.*Hard · 4 dots/)
    expect(screen.getByRole('button', { name: 'Mine' }).textContent).toMatch(/by you/)
    expect(screen.getByText('1 / 2 maps played')).toBeTruthy()
    fireEvent.click(spiral)
    expect(played.map((p) => p.id)).toEqual(['custom-a'])
  })

  it('keeps the last list but says so when a refresh fails', async () => {
    const server = fakePathfinderServer()
    await seedMap(server, 7, squarePuzzle('custom-a', 'Spiral'), true)
    const { focus } = renderPublished(server)
    await screen.findByRole('button', { name: 'Spiral' })
    server.failing = true
    focus.focus()
    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn't load published maps/)
    expect(screen.getByRole('button', { name: 'Spiral' })).toBeTruthy()
  })

  it('stops listening for focus when it unmounts', async () => {
    const { focus, unmount } = renderPublished()
    await screen.findByText(/No published maps yet/)
    expect(focus.listeners()).toBe(1)
    unmount()
    expect(focus.listeners()).toBe(0)
  })
})
