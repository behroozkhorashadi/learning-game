import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { DenButton } from './den_button.pure.ui.tsx'

const BACK_ICON = ['M10.25 6.75L4.75 12L10.25 17.25M19.25 12H5']

const meta = {
  title: 'app/den/DenButton',
  component: DenButton,
  args: { label: 'Play', onClick: fn() },
} satisfies Meta<typeof DenButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const QuietPill: Story = { args: { variant: 'quiet', shape: 'pill', size: 'lg' } }

export const SoftBlue: Story = { args: { variant: 'softBlue' } }

export const IconOnly: Story = {
  args: { label: 'Back', variant: 'quiet', shape: 'pill', iconOnly: true, iconPaths: BACK_ICON },
}

export const Disabled: Story = {
  args: { disabled: true },
}
