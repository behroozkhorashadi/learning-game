import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { HandoffPencil } from './handoff_pencil.pure.ui.tsx'

const meta = {
  title: 'app/session/HandoffPencil',
  component: HandoffPencil,
  args: { word: 'rabbit', onHearWord: fn(), onWroteIt: fn() },
} satisfies Meta<typeof HandoffPencil>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
