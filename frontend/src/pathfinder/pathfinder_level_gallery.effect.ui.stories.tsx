import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { ALL_LEVELS } from './pathfinder_levels.pure.lib.ts'
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

export const OpenALevel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = ALL_LEVELS[0]
    if (first === undefined) return
    await userEvent.click(canvas.getByRole('button', { name: first.name ?? first.id }))
    await expect(canvas.getByText(`0 / ${String(first.dots.length)} dots connected`)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Back to All Levels' }))
    await expect(canvas.getByText(/Dev QA — every level unlocked/)).toBeVisible()
  },
}
