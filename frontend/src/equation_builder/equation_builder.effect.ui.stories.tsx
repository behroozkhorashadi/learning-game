import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { fakePractice } from '@app/practice/practice_fakes.test.lib.ts'
import { bindEquationBuilder } from './equation_builder.effect.ui.tsx'
import { SESSION_EQUATIONS } from './equation_fixtures.test.lib.ts'
import { EQUATION_GAME_ID } from './equation_item.pure.lib.ts'

/** The real bound game over an in-memory practice loop. */
function Bound(): ReactElement {
  const [EquationBuilder] = useState(() => bindEquationBuilder({ practice: fakePractice(EQUATION_GAME_ID, SESSION_EQUATIONS).deps, speech: { speakText: fn(), speakWord: fn() } }))
  return <EquationBuilder profileId={1} onBack={fn()} />
}

const meta = {
  title: 'app/equation_builder/EquationBuilder',
  component: Bound,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const SolveOne: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Start' }))
    const tray = within(await canvas.findByRole('group', { name: 'Number tiles' }))
    await userEvent.click(tray.getByRole('button', { name: '7' }))
    await userEvent.click(canvas.getByRole('button', { name: /Check it/ }))
    await expect(await canvas.findByText('You built it!')).toBeVisible()
  },
}
