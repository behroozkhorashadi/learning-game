import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
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

export const Default: Story = {}

export const NewPlayer: Story = { args: { stats: NEW_PLAYER_STATS } }
