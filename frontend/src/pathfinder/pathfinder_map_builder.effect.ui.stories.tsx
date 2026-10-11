import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, userEvent, within } from 'storybook/test'
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

export const PlayASavedMap: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'My Maps' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Play Saved Square' }))
    await expect(canvas.getByText('0 / 4 dots connected')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Back to Builder' }))
    await expect(canvas.getByRole('button', { name: 'Check My Puzzle' })).toBeVisible()
  },
}
