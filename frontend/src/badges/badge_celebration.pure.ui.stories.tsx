import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
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

export const ArtStillPainting: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await waitFor(async () => {
      await expect(canvas.getByRole('heading', { name: 'On a Roll' })).toBeVisible()
    })
    await userEvent.click(canvas.getByRole('button', { name: 'Awesome!' }))
    await expect(args.onDone).toHaveBeenCalled()
  },
}

export const ArtReadyAndMoreWaiting: Story = { args: { badge: PATTERN_PRO, remaining: 2 } }

export const ReducedMotion: Story = { args: { animate: false } }

export const Toast: Story = {
  render: () => <BadgeToast badge={PATTERN_PRO} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Pattern Pro')
  },
}
