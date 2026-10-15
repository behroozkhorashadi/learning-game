import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { bindBadges } from './badges.effect.ui.tsx'
import { ART, BADGES, FIXTURE_NOW, STATS } from './badges_fixtures.test.lib.ts'

/** The real bound screen over fake loaders, a painter that answers after a moment, and a fixed clock. */
function Bound({ fails }: { readonly fails: boolean }): ReactElement {
  const [Badges] = useState(() =>
    bindBadges({
      loadBadges: () => Promise.resolve(BADGES),
      loadStats: () => (fails ? Promise.reject(new Error('GET /api/profiles/1/stats failed with HTTP 503')) : Promise.resolve(STATS)),
      loadGallery: () => Promise.resolve(ART),
      paint: (_id, key) => {
        const painted = BADGES.find((b) => b.key === key)
        return painted === undefined ? Promise.reject(new Error('no such badge')) : Promise.resolve({ ...painted, art_status: 'ready' as const, personal_art_url: '/images/badges/syllable_builder.png' })
      },
      motion: { prefersReduced: () => false, subscribe: () => () => undefined },
      now: () => FIXTURE_NOW,
      timers: { after: () => () => undefined, every: () => () => undefined },
      pollMs: 5000,
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

export const Default: Story = {}

export const LoadFails: Story = {
  args: { fails: true },
}
