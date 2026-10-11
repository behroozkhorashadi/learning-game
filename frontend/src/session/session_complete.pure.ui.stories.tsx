import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SessionComplete } from './session_complete.pure.ui.tsx'

const meta = {
  title: 'app/session/SessionComplete',
  component: SessionComplete,
  args: { headline: 'Great job!', subtitle: 'You built five words.', badgeSrc: '/images/badges/word-wizard.png', badgeTitle: 'Word Wizard', words: ['rab-bit', 'pen-cil', 'tur-tle'], onPlayAgain: fn(), onAllDone: fn() },
} satisfies Meta<typeof SessionComplete>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Play again' }))
    await expect(args.onPlayAgain).toHaveBeenCalledTimes(1)
  },
}
