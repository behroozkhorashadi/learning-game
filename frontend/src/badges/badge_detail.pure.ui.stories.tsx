import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { BadgeDetail } from './badge_detail.pure.ui.tsx'
import { JUST_EARNED, PATTERN_PRO, SHARPSHOOTER, STREAK_BADGE } from './badges_fixtures.test.lib.ts'

const meta = {
  title: 'app/badges/BadgeDetail',
  component: BadgeDetail,
  parameters: { layout: 'fullscreen' },
  args: { badge: SHARPSHOOTER, paint: 'idle', onPaint: fn(), onClose: fn(), animate: true },
} satisfies Meta<typeof BadgeDetail>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EarnedWithArt: Story = { args: { badge: PATTERN_PRO } }

export const EarnedWithoutArt: Story = {
  args: { badge: STREAK_BADGE },
}

export const Painting: Story = { args: { badge: JUST_EARNED } }
