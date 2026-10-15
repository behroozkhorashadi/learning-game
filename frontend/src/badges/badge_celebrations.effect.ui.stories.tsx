import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import type { BadgeRecord } from '@app/api/badges_schema.pure.lib.ts'
import { bindBadgeCelebrations } from './badge_celebrations.effect.ui.tsx'
import { JUST_EARNED, PATTERN_PRO } from './badges_fixtures.test.lib.ts'

/** The real bound celebrations over an in-memory list of new badges and timers that never fire. */
function Bound({ mode }: { readonly mode: 'party' | 'toast' }): ReactElement {
  const [Celebrations] = useState(() => {
    let waiting: readonly BadgeRecord[] = [JUST_EARNED, { ...PATTERN_PRO, celebrated: false }]
    return bindBadgeCelebrations({
      loadNew: () => Promise.resolve(waiting),
      markCelebrated: (_id, key) => {
        waiting = waiting.filter((b) => b.key !== key)
        return Promise.resolve()
      },
      timers: { after: () => () => undefined, every: () => () => undefined },
      motion: { prefersReduced: () => false, subscribe: () => () => undefined },
      pollMs: 8000,
    })
  })
  return <Celebrations profileId={1} mode={mode} />
}

const meta = {
  title: 'app/badges/BadgeCelebrations',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { mode: 'party' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InAGame: Story = {
  args: { mode: 'toast' },
}
