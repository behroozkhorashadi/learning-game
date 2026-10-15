import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { BadgeCelebration, BadgeToast } from './badge_celebration.pure.ui.tsx'
import { JUST_EARNED, PATTERN_PRO } from './badges_fixtures.test.lib.ts'

const meta = {
  title: 'app/badges/BadgeCelebration',
  component: BadgeCelebration,
  parameters: { layout: 'fullscreen' },
  args: { badge: JUST_EARNED, remaining: 0, animate: true, onDone: fn() },
} satisfies Meta<typeof BadgeCelebration>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ArtReadyAndMoreWaiting: Story = { args: { badge: PATTERN_PRO, remaining: 2 } }

export const ReducedMotion: Story = { args: { animate: false } }

export const Toast: Story = {
  render: () => <BadgeToast badge={PATTERN_PRO} />,
}
