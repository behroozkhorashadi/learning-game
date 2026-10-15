import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SessionStart } from './session_start.pure.ui.tsx'

const meta = {
  title: 'app/session/SessionStart',
  component: SessionStart,
  args: { eyebrow: 'Syllable Builder', headline: 'Build five words', subtitle: 'Slide the sounds together to make five words.', sessionLength: 5, heroSrc: '/images/hero-syllable.png', readingInstructions: false, onHearInstructions: fn(), onStart: fn(), onBack: fn() },
} satisfies Meta<typeof SessionStart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Reading: Story = {
  args: { readingInstructions: true },
}
