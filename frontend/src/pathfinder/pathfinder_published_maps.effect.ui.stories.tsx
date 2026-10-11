import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
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

export const PlayOne: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Spiral, played' }))
    await expect(args.onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 'custom-a' }))
    await expect(canvas.getByRole('button', { name: 'Mine' })).toHaveTextContent(/by you/)
  },
}

export const LoadFails: Story = {
  args: { loadFails: true },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('alert')).toHaveTextContent(/Couldn't load published maps/)
  },
}
