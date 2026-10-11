import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ArenaPerformanceSummary } from './arena_performance_summary.pure.ui.tsx'

const meta = {
  title: 'app/outbreak/ArenaPerformanceSummary',
  component: ArenaPerformanceSummary,
  args: {
    results: [
      { question: '3 + 4 = 7', correct: true, timeTakenMs: 2100 },
      { question: '6 + 3 = 9', correct: true, timeTakenMs: 1700 },
      { question: '9 - 3 = 6', correct: false, timeTakenMs: 6000 },
    ],
  },
} satisfies Meta<typeof ArenaPerformanceSummary>

export default meta
type Story = StoryObj<typeof meta>

export const AfterARound: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('2 / 3')).toBeVisible()
  },
}

export const NothingAnswered: Story = { args: { results: [] } }
