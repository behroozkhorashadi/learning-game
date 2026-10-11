import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakePathfinderServer, seedMap, squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { bindPathfinderLevelSelect, type PathfinderLevelSelectProps } from './pathfinder_level_select.effect.ui.tsx'
import { computeLevelStatuses } from './pathfinder_progress.pure.lib.ts'
import type { DotPuzzle } from './pathfinder_state.pure.lib.ts'

afterEach(cleanup)

const LEVELS: readonly DotPuzzle[] = [
  { ...squarePuzzle('e1', 'Easy One'), difficulty: 'easy' },
  { ...squarePuzzle('e2', 'Easy Two'), difficulty: 'easy' },
  { ...squarePuzzle('m1', 'Medium One'), difficulty: 'medium' },
]

function renderSelect(server = fakePathfinderServer(), completed: ReadonlySet<string> = new Set()): PathfinderLevelSelectProps {
  const LevelSelect = bindPathfinderLevelSelect({ listMaps: server.listMaps })
  const props: PathfinderLevelSelectProps = { profileId: 1, statuses: computeLevelStatuses(LEVELS, completed), onSelect: vi.fn(), onBuild: vi.fn(), onBrowsePublished: vi.fn() }
  render(<LevelSelect {...props} />)
  return props
}

describe('PathfinderLevelSelect', () => {
  it('groups levels by tier and marks each locked, open, or completed', () => {
    renderSelect(undefined, new Set(['e1']))
    expect(screen.getByRole('region', { name: 'Easy maps' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Medium maps' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Easy One, completed' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'Easy Two' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'Medium One, locked' })).toHaveProperty('disabled', true)
    expect(screen.getByText('1 / 3 maps completed')).toBeTruthy()
  })

  it('opens an unlocked level, the builder, and the published list', () => {
    const props = renderSelect()
    fireEvent.click(screen.getByRole('button', { name: 'Easy One' }))
    fireEvent.click(screen.getByRole('button', { name: /Build Your Own Map/ }))
    fireEvent.click(screen.getByRole('button', { name: /Published Maps/ }))
    expect(props.onSelect).toHaveBeenCalledWith('e1')
    expect([vi.mocked(props.onBuild).mock.calls.length, vi.mocked(props.onBrowsePublished).mock.calls.length]).toEqual([1, 1])
  })

  it('counts saved maps on the build card, and pitches it when there are none or the count fails', async () => {
    const server = fakePathfinderServer()
    await seedMap(server, 1, squarePuzzle('custom-1'))
    await seedMap(server, 1, squarePuzzle('custom-2'))
    renderSelect(server)
    expect(await screen.findByText("2 maps you've built")).toBeTruthy()
    cleanup()

    const down = fakePathfinderServer()
    down.failing = true
    renderSelect(down)
    expect(screen.getByText('Design a puzzle, check it, and play it')).toBeTruthy()
  })
})
