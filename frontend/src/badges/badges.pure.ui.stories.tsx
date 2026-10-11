import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { BadgesView } from './badges.pure.ui.tsx'
import { BADGES, NEW_PLAYER_STATS, STATS } from './badges_fixtures.test.lib.ts'

const meta = {
  title: 'app/badges/BadgesView',
  component: BadgesView,
  parameters: { layout: 'fullscreen' },
  args: { state: loaded({ badges: BADGES, stats: STATS }), kidName: 'Mia', now: new Date('2026-01-05T15:00:00Z'), onBack: fn() },
} satisfies Meta<typeof BadgesView>

export default meta
type Story = StoryObj<typeof meta>

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Locked')).toBeVisible()
  },
}

export const NewPlayer: Story = { args: { state: loaded({ badges: [], stats: NEW_PLAYER_STATS }) } }

export const Loading: Story = { args: { state: LOADING } }

export const Failed: Story = {
  args: { state: failed('GET /api/profiles/1/badges failed with HTTP 500') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeVisible()
  },
}
