import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fakePathfinderScreens } from './pathfinder_screens.test.ui.tsx'

/** The real dev gallery: every curated level unlocked, with its assessed score. */
function Bound(): ReactElement {
  const [{ LevelGallery }] = useState(() => fakePathfinderScreens())
  return <LevelGallery />
}

const meta = {
  title: 'app/pathfinder/PathfinderLevelGallery',
  component: Bound,
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
