import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { BadgesView } from './badges.pure.ui.tsx'
import { ART, BADGES, FIXTURE_NOW, NEW_PLAYER_STATS, STATS } from './badges_fixtures.test.lib.ts'

const meta = {
  title: 'app/badges/BadgesView',
  component: BadgesView,
  parameters: { layout: 'fullscreen' },
  args: { state: loaded({ badges: BADGES, stats: STATS }), gallery: loaded(ART), kidName: 'Mia', now: FIXTURE_NOW, onBack: fn(), painting: {}, onPaint: fn(), animate: true },
} satisfies Meta<typeof BadgesView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NewPlayer: Story = { args: { state: loaded({ badges: [], stats: NEW_PLAYER_STATS }), gallery: loaded([]) } }

export const GalleryFails: Story = {
  args: { gallery: failed('GET /api/profiles/1/armory/art failed with HTTP 500') },
}

export const Loading: Story = { args: { state: LOADING } }

export const Failed: Story = {
  args: { state: failed('GET /api/profiles/1/badges failed with HTTP 500') },
}
