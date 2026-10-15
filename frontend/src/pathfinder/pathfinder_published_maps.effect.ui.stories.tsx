import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { fakePathfinderServer, manualFocus, squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { bindPathfinderPublishedMaps } from './pathfinder_published_maps.effect.ui.tsx'
import type { DotPuzzle } from './pathfinder_state.pure.lib.ts'

interface BoundProps {
  readonly loadFails: boolean
  readonly onPlay: (puzzle: DotPuzzle) => void
}

/** The real bound list over an in-memory server with two published maps, one of them played. */
function Bound({ loadFails, onPlay }: BoundProps): ReactElement {
  const [PublishedMaps] = useState(() => {
    const server = fakePathfinderServer()
    server.profileNames.set(7, 'Sam')
    server.seed(7, squarePuzzle('custom-a', 'Spiral'), true)
    server.seed(1, squarePuzzle('custom-b', 'Mine'), true)
    server.failing = loadFails
    return bindPathfinderPublishedMaps({ listPublishedMaps: server.listPublishedMaps, subscribeToFocus: manualFocus().subscribe })
  })
  return <PublishedMaps profileId={1} completedIds={new Set(['custom-a'])} onPlay={onPlay} />
}

const meta = {
  title: 'app/pathfinder/PathfinderPublishedMaps',
  component: Bound,
  args: { loadFails: false, onPlay: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LoadFails: Story = {
  args: { loadFails: true },
}
