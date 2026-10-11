import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { bindBadges } from './badges.effect.ui.tsx'
import { BADGES, STATS } from './badges_fixtures.test.lib.ts'

/** The real bound screen over fake loaders and a fixed clock. */
function Bound({ fails }: { readonly fails: boolean }): ReactElement {
  const [Badges] = useState(() =>
    bindBadges({
      loadBadges: () => Promise.resolve(BADGES),
      loadStats: () => (fails ? Promise.reject(new Error('GET /api/profiles/1/stats failed with HTTP 503')) : Promise.resolve(STATS)),
      now: () => new Date('2026-01-05T15:00:00Z'),
    }),
  )
  return <Badges profileId={1} kidName="Mia" onBack={fn()} />
}

const meta = {
  title: 'app/badges/Badges',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { fails: false },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const KidThenParent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Your badges')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Switch to parent view' }))
    await expect(canvas.getByText('Learning insights')).toBeVisible()
  },
}

export const LoadFails: Story = {
  args: { fails: true },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('alert')).toHaveTextContent('HTTP 503')
  },
}
