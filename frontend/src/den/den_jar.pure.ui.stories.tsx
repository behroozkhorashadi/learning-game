import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { DenJar } from './den_jar.pure.ui.tsx'

const meta = {
  title: 'app/den/DenJar',
  component: DenJar,
  args: { count: 42, goal: 120 },
} satisfies Meta<typeof DenJar>

export default meta
type Story = StoryObj<typeof meta>

export const PartlyFull: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('words so far')).toBeVisible()
  },
}

export const Full: Story = {
  args: { count: 120 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('jar is full!')).toBeVisible()
  },
}
