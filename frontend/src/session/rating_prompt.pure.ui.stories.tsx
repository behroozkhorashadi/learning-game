import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { RatingPrompt } from './rating_prompt.pure.ui.tsx'

const meta = {
  title: 'app/session/RatingPrompt',
  component: RatingPrompt,
  args: { onRate: fn(), onDismiss: fn() },
} satisfies Meta<typeof RatingPrompt>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: '4 stars' }))
    await expect(args.onRate).toHaveBeenCalledWith(4)
    await expect(within(canvasElement).getByText('Glad you liked it')).toBeVisible()
  },
}
