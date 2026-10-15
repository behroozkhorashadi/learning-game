import type { Meta, StoryObj } from '@storybook/react-vite'
import { CardShell } from './card_shell.pure.ui.tsx'

const meta = {
  title: 'app/profiles/CardShell',
  component: CardShell,
  parameters: { layout: 'fullscreen' },
  args: { children: <p>Card content</p> },
} satisfies Meta<typeof CardShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
