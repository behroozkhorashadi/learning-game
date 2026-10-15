import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { PathfinderPlayPanel } from './pathfinder_play_panel.pure.ui.tsx'
import type { PathfinderPlayState } from './use_pathfinder_play.pure.hook.ts'

const play = (overrides: Partial<PathfinderPlayState> = {}): PathfinderPlayState => ({
  path: [{ row: 0, col: 0 }],
  completed: false,
  progress: { visited: 1, total: 4 },
  invalidReason: null,
  stuck: false,
  canUndo: true,
  canRestart: true,
  handleDotClick: fn(),
  handleUndo: fn(),
  handleRestart: fn(),
  ...overrides,
})

const meta = {
  title: 'app/pathfinder/PathfinderPlayPanel',
  component: PathfinderPlayPanel,
  args: { puzzle: squarePuzzle('panel'), title: 'Loop', play: play(), completeMessage: 'Every dot connected! 🎉', actions: null },
} satisfies Meta<typeof PathfinderPlayPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InvalidMove: Story = {
  args: { play: play({ invalidReason: "That dot's already used — no going back." }) },
}

export const Complete: Story = {
  args: { play: play({ completed: true, progress: { visited: 4, total: 4 } }) },
}
