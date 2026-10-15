import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { fakePathfinderServer, squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { fakePathfinderScreens } from './pathfinder_screens.test.ui.tsx'

interface BoundProps {
  readonly loadFails: boolean
}

/** The real bound library over an in-memory server seeded with two maps; dialogs confirm and accept. */
function Bound({ loadFails }: BoundProps): ReactElement {
  const [{ MyMaps }] = useState(() => {
    const server = fakePathfinderServer()
    server.seed(1, squarePuzzle('custom-1', 'Spiral'))
    server.seed(1, { ...squarePuzzle('custom-2', 'Zig Zag'), difficulty: 'hard' })
    server.failing = loadFails
    return fakePathfinderScreens(server)
  })
  return <MyMaps profileId={1} onBack={fn()} onPlay={fn()} />
}

const meta = {
  title: 'app/pathfinder/PathfinderMyMaps',
  component: Bound,
  args: { loadFails: false },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LoadFails: Story = {
  args: { loadFails: true },
}
