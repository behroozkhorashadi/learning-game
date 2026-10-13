import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { BadgesView } from './badges.pure.ui.tsx'
import { ART, BADGES, NEW_PLAYER_STATS, STATS } from './badges_fixtures.test.lib.ts'

const meta = {
  title: 'app/badges/BadgesView',
  component: BadgesView,
  parameters: { layout: 'fullscreen' },
  args: { state: loaded({ badges: BADGES, stats: STATS }), gallery: loaded(ART), kidName: 'Mia', now: new Date('2026-01-05T15:00:00Z'), onBack: fn() },
} satisfies Meta<typeof BadgesView>

export default meta
type Story = StoryObj<typeof meta>

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Locked')).toBeVisible()
    await expect(canvas.getByRole('img', { name: 'Comic Hero: a pet dragon' })).toBeVisible()
  },
}

export const NewPlayer: Story = { args: { state: loaded({ badges: [], stats: NEW_PLAYER_STATS }), gallery: loaded([]) } }

export const GalleryFails: Story = {
  args: { gallery: failed('GET /api/profiles/1/armory/art failed with HTTP 500') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('HTTP 500')
    await expect(canvas.getByText('Locked')).toBeVisible()
  },
}

export const Loading: Story = { args: { state: LOADING } }

export const Failed: Story = {
  args: { state: failed('GET /api/profiles/1/badges failed with HTTP 500') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeVisible()
  },
}
