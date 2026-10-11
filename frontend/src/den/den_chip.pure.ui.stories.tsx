import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { DenChip } from './den_chip.pure.ui.tsx'

const meta = {
  title: 'app/den/DenChip',
  component: DenChip,
  args: { label: 'Level 2' },
} satisfies Meta<typeof DenChip>

export default meta
type Story = StoryObj<typeof meta>

export const Neutral: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Level 2')).toBeVisible()
  },
}

export const GreenMono: Story = { args: { tone: 'green', mono: true } }

export const WithIcon: Story = { args: { tone: 'purple', iconPaths: ['M12 4.75V19.25M4.75 12H19.25'] } }
