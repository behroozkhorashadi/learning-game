import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SessionStart } from './session_start.pure.ui.tsx'

const meta = {
  title: 'app/session/SessionStart',
  component: SessionStart,
  args: { eyebrow: 'Syllable Builder', headline: 'Build five words', subtitle: 'Slide the sounds together to make five words.', sessionLength: 5, heroSrc: '/images/hero-syllable.png', readingInstructions: false, onHearInstructions: fn(), onStart: fn(), onBack: fn() },
} satisfies Meta<typeof SessionStart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Start' }))
    await expect(args.onStart).toHaveBeenCalledTimes(1)
  },
}

export const Reading: Story = {
  args: { readingInstructions: true },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Stop reading' }))
    await expect(args.onHearInstructions).toHaveBeenCalledTimes(1)
  },
}
