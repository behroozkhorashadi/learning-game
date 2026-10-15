import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { StubReveal } from '@app/writing/stub_reveal.test.ui.tsx'
import { fakeWritingDeps } from '@app/writing/writing_fakes.test.lib.ts'
import { bindPromptForge } from './prompt_forge.effect.ui.tsx'

/** The real bound game over an in-memory pieces store and instant timers. */
function Bound(): ReactElement {
  const [PromptForge] = useState(() => bindPromptForge({ ...fakeWritingDeps(), IllustrationReveal: StubReveal }))
  return <PromptForge profileId={1} onBack={fn()} onFinished={fn()} />
}

const meta = {
  title: 'app/prompt_forge/PromptForge',
  component: Bound,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
