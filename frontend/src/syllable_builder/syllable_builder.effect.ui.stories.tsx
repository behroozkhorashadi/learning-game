import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { fakePractice } from '@app/practice/practice_fakes.test.lib.ts'
import { bindSyllableBuilder } from './syllable_builder.effect.ui.tsx'
import { SESSION_WORDS } from './syllable_fixtures.test.lib.ts'
import { SYLLABLE_GAME_ID } from './syllable_item.pure.lib.ts'

/** The real bound game over an in-memory practice loop. */
function Bound(): ReactElement {
  const [SyllableBuilder] = useState(() => bindSyllableBuilder({ practice: fakePractice(SYLLABLE_GAME_ID, SESSION_WORDS).deps, speech: { speakText: fn(), speakWord: fn() } }))
  return <SyllableBuilder profileId={1} profileName="Mia" onBack={fn()} />
}

const meta = {
  title: 'app/syllable_builder/SyllableBuilder',
  component: Bound,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const BuildAWord: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Start' }))
    const tray = within(await canvas.findByRole('group', { name: 'Sound tiles' }))
    await userEvent.click(tray.getByRole('button', { name: 'a' }))
    await userEvent.click(tray.getByRole('button', { name: 'b' }))
    await userEvent.click(canvas.getByRole('button', { name: /Check it/ }))
    await expect(await canvas.findByText('You built it!')).toBeVisible()
  },
}
