import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ProgressBar } from './progress_bar.pure.ui.tsx'

const meta = {
  title: 'app/session/ProgressBar',
  component: ProgressBar,
  args: { total: 5, currentIndex: 0, onBack: fn() },
} satisfies Meta<typeof ProgressBar>

export default meta
type Story = StoryObj<typeof meta>

export const FirstItem: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Item 1 of 5')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }))
    await expect(args.onBack).toHaveBeenCalledTimes(1)
  },
}

export const Midway: Story = {
  args: { currentIndex: 2 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Item 3 of 5')).toBeVisible()
  },
}

export const LastItem: Story = { args: { currentIndex: 4 } }

export const AllDone: Story = {
  args: { currentIndex: 5 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('5')).toBeVisible()
  },
}
