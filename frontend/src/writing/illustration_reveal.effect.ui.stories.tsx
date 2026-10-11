import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { INSTANT_TIMERS } from '@app/timing/manual_timers.test.lib.ts'
import { bindIllustrationReveal } from './illustration_reveal.effect.ui.tsx'
import { fakeIllustrator } from './writing_fixtures.test.lib.ts'

/** The real bound reveal over a fake illustrator and instant timers. */
function Bound({ fails }: { readonly fails: boolean }): ReactElement {
  const [IllustrationReveal] = useState(() => bindIllustrationReveal({ generateIllustration: fakeIllustrator(fails).generateIllustration, timers: INSTANT_TIMERS }))
  return <IllustrationReveal pieceId="p1" pieceTitle="The crow and the map" wordCount={42} heroExcerpt="The crow found a map under the seat." moments={['The bus stopped at the fog.']} onReadItBack={fn()} onWriteSomethingElse={fn()} />
}

const meta = {
  title: 'app/writing/IllustrationReveal',
  component: Bound,
  args: { fails: false },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const RevealAndSave: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Save to my storybook' }))
    await expect(canvas.getByText('In your storybook')).toBeVisible()
  },
}

export const GenerationFails: Story = {
  args: { fails: true },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('I drew what you wrote.')).toBeVisible()
  },
}
