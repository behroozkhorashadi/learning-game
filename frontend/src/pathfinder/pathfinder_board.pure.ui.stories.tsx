import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PathfinderBoard } from './pathfinder_board.pure.ui.tsx'
import { squarePuzzle } from './pathfinder_fakes.test.lib.ts'

const meta = {
  title: 'app/pathfinder/PathfinderBoard',
  component: PathfinderBoard,
  args: { puzzle: squarePuzzle('board'), path: [], onDotClick: fn() },
} satisfies Meta<typeof PathfinderBoard>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.pointer({ keys: '[MouseLeft]', target: within(canvasElement).getByRole('button', { name: 'Dot at row 1, column 1' }) })
    await expect(args.onDotClick).toHaveBeenCalledWith({ row: 0, col: 0 })
  },
}

export const PathInProgress: Story = {
  args: {
    path: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Dot at row 2, column 2, visited' })).toBeInTheDocument()
  },
}

export const Disabled: Story = { args: { disabled: true } }
