import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { expect, within } from 'storybook/test'
import { BADGE_CATEGORIES, BADGE_TIERS } from '@app/api/badges_schema.pure.lib.ts'
import { BadgeMedal } from './badge_medal.pure.ui.tsx'
import { PATTERN_PRO, SHARPSHOOTER, badge } from './badges_fixtures.test.lib.ts'

/** Every tier and category, earned; then locked, and with painted art. */
function Gallery({ animate }: { readonly animate: boolean }): ReactElement {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 24, background: '#FFF6EA' }}>
      {BADGE_TIERS.map((tier) => (
        <BadgeMedal key={tier} badge={badge({ key: tier, name: `${tier} medal`, tier, earned: true })} size={110} animate={animate} />
      ))}
      {BADGE_CATEGORIES.map((category) => (
        <BadgeMedal key={category} badge={badge({ key: category, name: `${category} medal`, category, tier: 'gold', earned: true })} size={110} animate={animate} />
      ))}
      <BadgeMedal badge={SHARPSHOOTER} size={110} animate={animate} />
      <BadgeMedal badge={PATTERN_PRO} size={110} animate={animate} />
    </div>
  )
}

const meta = {
  title: 'app/badges/BadgeMedal',
  component: Gallery,
  args: { animate: true },
} satisfies Meta<typeof Gallery>

export default meta
type Story = StoryObj<typeof meta>

export const AllMedals: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'legend medal badge, legendary, earned' })).toBeVisible()
    await expect(canvas.getByRole('img', { name: 'Sharpshooter badge, silver, locked' })).toBeVisible()
  },
}

export const Still: Story = { args: { animate: false } }
