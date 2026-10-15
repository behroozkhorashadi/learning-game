import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { RatingPrompt } from './rating_prompt.pure.ui.tsx'

const meta = {
  title: 'app/session/RatingPrompt',
  component: RatingPrompt,
  args: { onRate: fn(), onDismiss: fn() },
} satisfies Meta<typeof RatingPrompt>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
