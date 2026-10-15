import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fakePathfinderServer, squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { fakePathfinderScreens } from './pathfinder_screens.test.ui.tsx'

/** The real builder (editor, library, play-test) over an in-memory server with one saved map. */
function Bound(): ReactElement {
  const [{ MapBuilder }] = useState(() => {
    const server = fakePathfinderServer()
    server.seed(1, squarePuzzle('custom-1', 'Saved Square'))
    return fakePathfinderScreens(server)
  })
  return <MapBuilder profileId={1} username="mia" />
}

const meta = {
  title: 'app/pathfinder/PathfinderMapBuilder',
  component: Bound,
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
