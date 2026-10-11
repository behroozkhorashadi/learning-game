import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { HandoffPencil } from './handoff_pencil.pure.ui.tsx'

const meta = {
  title: 'app/session/HandoffPencil',
  component: HandoffPencil,
  args: { word: 'rabbit', onHearWord: fn(), onWroteIt: fn() },
} satisfies Meta<typeof HandoffPencil>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Hear the word' }))
    await expect(args.onHearWord).toHaveBeenCalledTimes(1)
  },
}
