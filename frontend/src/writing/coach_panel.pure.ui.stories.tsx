import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CoachPanel } from './coach_panel.pure.ui.tsx'
import { QUESTIONS } from './writing_fixtures.test.lib.ts'

const meta = {
  title: 'app/writing/CoachPanel',
  component: CoachPanel,
  parameters: { layout: 'fullscreen' },
  args: { pieceTitle: 'The crow and the map', value: 'The crow found a map under the bus seat.', onChange: fn(), status: 'questions', questions: QUESTIONS, onHappy: fn() },
} satisfies Meta<typeof CoachPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Questions: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: "I'm happy with it" }))
    await expect(args.onHappy).toHaveBeenCalled()
  },
}

export const Thinking: Story = { args: { status: 'thinking', questions: [] } }

export const Done: Story = { args: { status: 'done' } }
