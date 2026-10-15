import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
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

export const Default: Story = {}
