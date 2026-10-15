import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { manualTimers, squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { bindPathfinderPlayTest } from './pathfinder_playtest.effect.ui.tsx'

/** The real bound play-test screen; the feedback timer never fires, so a rejection message stays visible. */
function Bound({ onBack }: { readonly onBack: () => void }): ReactElement {
  const [PlayTest] = useState(() => bindPathfinderPlayTest({ scheduleTimeout: manualTimers().schedule }))
  return <PlayTest puzzle={squarePuzzle('story', 'Square')} onBack={onBack} />
}

const meta = {
  title: 'app/pathfinder/PathfinderPlayTest',
  component: Bound,
  args: { onBack: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
