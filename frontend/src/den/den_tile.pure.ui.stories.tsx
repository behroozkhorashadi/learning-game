import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DenTile } from './den_tile.pure.ui.tsx'

const meta = {
  title: 'app/den/DenTile',
  component: DenTile,
  args: { label: 'cat', onClick: fn() },
} satisfies Meta<typeof DenTile>

export default meta
type Story = StoryObj<typeof meta>

export const Purple: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'cat' }))
    await expect(args.onClick).toHaveBeenCalledTimes(1)
  },
}

export const SelectedBlue: Story = { args: { theme: 'blue', selected: true } }

export const Phrase: Story = { args: { label: 'once upon a time', size: 'phrase', theme: 'amber' } }
