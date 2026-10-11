import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { StubReveal } from '@app/writing/stub_reveal.test.ui.tsx'
import { fakeWritingDeps } from '@app/writing/writing_fakes.test.lib.ts'
import { bindStyleRemix } from './style_remix.effect.ui.tsx'

/** The real bound game over an in-memory pieces store and instant timers. */
function Bound(): ReactElement {
  const [StyleRemix] = useState(() => bindStyleRemix({ ...fakeWritingDeps(), IllustrationReveal: StubReveal }))
  return <StyleRemix profileId={1} onBack={fn()} onFinished={fn()} />
}

const meta = {
  title: 'app/style_remix/StyleRemixLab',
  component: Bound,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const RemixOnce: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Draw a style' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Start writing' }))
    await userEvent.type(canvas.getByLabelText('Your remix'), 'The gate creaked open in the storm and something small slipped away into the dark.')
    await userEvent.click(canvas.getByRole('button', { name: 'Put it on the shelf' }))
    await expect(canvas.getByText('Same scene, 1 ways')).toBeVisible()
  },
}
