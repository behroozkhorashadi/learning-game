import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ParentBadge } from './parent_badge.pure.ui.tsx'

const meta = { title: 'app/parents/ParentBadge', component: ParentBadge, args: { name: 'Mom', size: 96 } } satisfies Meta<typeof ParentBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Initial: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('M')).toBeVisible()
  },
}
