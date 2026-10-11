import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
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

export const FirstExchange: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: "I'll start us off →" }))
    await userEvent.type(await canvas.findByLabelText('Your line'), 'I pressed it because nobody was watching.')
    await userEvent.click(canvas.getByRole('button', { name: 'Pass it back →' }))
    await expect(await canvas.findByLabelText('Your line')).toBeVisible()
  },
}
