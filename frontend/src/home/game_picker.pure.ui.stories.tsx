import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { GamePickerView } from './game_picker.pure.ui.tsx'
import { GAMES } from './home_fixtures.test.lib.ts'

const meta = {
  title: 'app/home/GamePickerView',
  component: GamePickerView,
  parameters: { layout: 'fullscreen' },
  args: { games: loaded(GAMES), age: 7, profile: { name: 'Mia', birth_year: 2019 }, onSelectGame: fn(), onSwitchProfile: fn(), onEditProfile: fn(), onViewBadges: fn(), onOpenPracticeSettings: fn() },
} satisfies Meta<typeof GamePickerView>

export default meta
type Story = StoryObj<typeof meta>

export const Home: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText('Pathfinder'))
    await expect(args.onSelectGame).toHaveBeenCalledWith('pathfinder_no_way_back')
  },
}

export const CatalogFails: Story = {
  args: { games: failed('GET /api/games failed with HTTP 503') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeVisible()
  },
}
