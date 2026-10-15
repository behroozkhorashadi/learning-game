import type { Meta, StoryObj } from '@storybook/react-vite'
import { DenFlipCard } from './den_flip_card.pure.ui.tsx'

const meta = {
  title: 'app/den/DenFlipCard',
  component: DenFlipCard,
  args: { kicker: 'Prefix', cardName: 'un-', meaning: 'Means "not".', example: 'unhappy, undo', tier: 2, backLabel: 'Word part', iconPaths: ['M12 4.75V19.25M4.75 12H19.25'] },
} satisfies Meta<typeof DenFlipCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Back: Story = { args: { flipped: false } }
