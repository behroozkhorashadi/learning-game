import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { StubReveal } from '@app/writing/stub_reveal.test.ui.tsx'
import { fakeWritingDeps } from '@app/writing/writing_fakes.test.lib.ts'
import { bindClueMaster } from './clue_master.effect.ui.tsx'

/** The real bound game over an in-memory pieces store and instant timers. */
function Bound(): ReactElement {
  const [ClueMaster] = useState(() => bindClueMaster({ ...fakeWritingDeps(), IllustrationReveal: StubReveal }))
  return <ClueMaster profileId={1} onBack={fn()} onFinished={fn()} />
}

const meta = {
  title: 'app/clue_master/ClueMaster',
  component: Bound,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const DealAnEnding: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Deal my ending' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Start writing →' }))
    await expect(canvas.getByLabelText('Your draft')).toBeVisible()
  },
}
