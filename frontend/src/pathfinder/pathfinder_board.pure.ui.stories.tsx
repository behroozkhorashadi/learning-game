import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PathfinderBoard } from './pathfinder_board.pure.ui.tsx'
import { squarePuzzle } from './pathfinder_fakes.test.lib.ts'

const meta = {
  title: 'app/pathfinder/PathfinderBoard',
  component: PathfinderBoard,
  args: { puzzle: squarePuzzle('board'), path: [], onDotClick: fn() },
} satisfies Meta<typeof PathfinderBoard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const PathInProgress: Story = {
  args: {
    path: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ],
  },
}

export const Disabled: Story = { args: { disabled: true } }
