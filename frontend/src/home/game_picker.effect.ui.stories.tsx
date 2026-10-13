import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, within } from 'storybook/test'
import { bindGamePicker } from './game_picker.effect.ui.tsx'
import { GAMES } from './home_fixtures.test.lib.ts'

/** The bound home over a fake catalog. */
function Bound(): ReactElement {
  const [GamePicker] = useState(() => bindGamePicker({ listGames: () => Promise.resolve(GAMES), currentYear: 2026 }))
  return <GamePicker profile={{ name: 'Mia', birth_year: 2019 }} onSelectGame={fn()} onSwitchProfile={fn()} onEditProfile={fn()} onViewBadges={fn()} onOpenPracticeSettings={fn()} />
}

const meta = {
  title: 'app/home/GamePicker',
  component: Bound,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const LoadsCatalog: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Equation Outbreak')).toBeVisible()
  },
}
