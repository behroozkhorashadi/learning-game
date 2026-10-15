import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { StubReveal } from '@app/writing/stub_reveal.test.ui.tsx'
import { fakeWritingDeps } from '@app/writing/writing_fakes.test.lib.ts'
import { bindTagTeam } from './tag_team.effect.ui.tsx'

/** The real bound game over an in-memory pieces store and instant timers. */
function Bound(): ReactElement {
  const [TagTeam] = useState(() => bindTagTeam({ ...fakeWritingDeps(), IllustrationReveal: StubReveal }))
  return <TagTeam profileId={1} onBack={fn()} onFinished={fn()} />
}

const meta = {
  title: 'app/tag_team/TagTeamStory',
  component: Bound,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
