import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ProgressBar } from './progress_bar.pure.ui.tsx'

const meta = {
  title: 'app/session/ProgressBar',
  component: ProgressBar,
  args: { total: 5, currentIndex: 0, onBack: fn() },
} satisfies Meta<typeof ProgressBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Midway: Story = {
  args: { currentIndex: 2 },
}

export const LastItem: Story = { args: { currentIndex: 4 } }

export const AllDone: Story = {
  args: { currentIndex: 5 },
}
