import type { Meta, StoryObj } from '@storybook/react-vite'
import { DenJar } from './den_jar.pure.ui.tsx'

const meta = {
  title: 'app/den/DenJar',
  component: DenJar,
  args: { count: 42, goal: 120 },
} satisfies Meta<typeof DenJar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Full: Story = {
  args: { count: 120 },
}
