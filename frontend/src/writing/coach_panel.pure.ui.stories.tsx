import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
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

export const Default: Story = {}

export const Thinking: Story = { args: { status: 'thinking', questions: [] } }

export const Done: Story = { args: { status: 'done' } }
