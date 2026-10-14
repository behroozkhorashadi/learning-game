import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor, within } from 'storybook/test'
import { StreakDetail } from './streak_detail.pure.ui.tsx'
import { FIXTURE_NOW, NEW_PLAYER_STATS, STATS } from './badges_fixtures.test.lib.ts'

const meta = {
  title: 'app/badges/StreakDetail',
  component: StreakDetail,
  parameters: { layout: 'fullscreen' },
  args: { stats: STATS, today: FIXTURE_NOW, onClose: fn() },
} satisfies Meta<typeof StreakDetail>

export default meta
type Story = StoryObj<typeof meta>

export const OnAStreak: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(async () => {
      await expect(canvas.getByRole('heading', { name: '3 days in a row!' })).toBeVisible()
    })
    await waitFor(async () => {
      await expect(canvas.getByRole('table', { name: 'Days played in the last six weeks' })).toBeVisible()
    })
  },
}

export const NewPlayer: Story = { args: { stats: NEW_PLAYER_STATS } }
