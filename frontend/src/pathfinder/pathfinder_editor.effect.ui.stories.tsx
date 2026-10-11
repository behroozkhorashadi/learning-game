import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
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

async function buildSquare(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement)
  for (const [row, col] of [
    [1, 1],
    [1, 2],
    [2, 2],
    [2, 1],
  ] as const) {
    await userEvent.click(canvas.getByRole('button', { name: new RegExp(`row ${String(row)}, column ${String(col)},`) }))
  }
  await userEvent.click(canvas.getByRole('button', { name: 'Check My Puzzle' }))
}

export const BuildCheckAndSave: Story = {
  play: async ({ canvasElement }) => {
    await buildSquare(canvasElement)
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Solvable! Assessed difficulty: Easy/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(await canvas.findByText('Saved as "mia_map1" — find it under My Maps.')).toBeVisible()
  },
}

export const Unsolvable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /row 1, column 1,/ }))
    await userEvent.click(canvas.getByRole('button', { name: /row 4, column 4,/ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Check My Puzzle' }))
    await expect(canvas.getByText(/Not solvable yet/)).toBeVisible()
  },
}

export const SaveFails: Story = {
  args: { saveFails: true },
  play: async ({ canvasElement }) => {
    await buildSquare(canvasElement)
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Save' }))
    await expect(await within(canvasElement).findByText(/Couldn't save your map/)).toBeVisible()
  },
}
