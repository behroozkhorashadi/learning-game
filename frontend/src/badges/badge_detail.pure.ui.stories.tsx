import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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

export const Locked: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '22 of 25 right in a row')
    await userEvent.keyboard('{Escape}')
    await expect(args.onClose).toHaveBeenCalled()
  },
}

export const EarnedWithArt: Story = { args: { badge: PATTERN_PRO } }

export const EarnedWithoutArt: Story = {
  args: { badge: STREAK_BADGE },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Paint my badge' }))
    await expect(args.onPaint).toHaveBeenCalled()
  },
}

export const Painting: Story = { args: { badge: JUST_EARNED } }
