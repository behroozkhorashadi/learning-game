import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { fakePathfinderScreens } from './pathfinder_screens.test.ui.tsx'
import type { DotPuzzle } from './pathfinder_state.pure.lib.ts'

interface BoundProps {
  readonly saveFails: boolean
  readonly onPlay: (puzzle: DotPuzzle) => void
}

/** The real bound editor over an in-memory map library; the name prompt accepts its suggestion. */
function Bound({ saveFails, onPlay }: BoundProps): ReactElement {
  const [{ Editor }] = useState(() => {
    const screens = fakePathfinderScreens()
    screens.server.failing = saveFails
    return screens
  })
  return <Editor profileId={1} username="mia" onPlay={onPlay} onViewMyMaps={fn()} />
}

const meta = {
  title: 'app/pathfinder/PathfinderEditor',
  component: Bound,
  args: { saveFails: false, onPlay: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SaveFails: Story = {
  args: { saveFails: true },
}
