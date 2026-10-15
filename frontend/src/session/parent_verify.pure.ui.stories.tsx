import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ParentVerify } from './parent_verify.pure.ui.tsx'

const meta = {
  title: 'app/session/ParentVerify',
  component: ParentVerify,
  args: { word: 'rabbit', kidName: 'Mia', onResult: fn() },
} satisfies Meta<typeof ParentVerify>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
