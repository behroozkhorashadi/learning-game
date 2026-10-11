import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { manualTimers, squarePuzzle } from './pathfinder_fakes.test.lib.ts'
import { bindPathfinderPlayTest } from './pathfinder_playtest.effect.ui.tsx'

/** The real bound play-test screen; the feedback timer never fires, so a rejection message stays visible. */
function Bound({ onBack }: { readonly onBack: () => void }): ReactElement {
  const [PlayTest] = useState(() => bindPathfinderPlayTest({ scheduleTimeout: manualTimers().schedule }))
  return <PlayTest puzzle={squarePuzzle('story', 'Square')} onBack={onBack} />
}

const meta = {
  title: 'app/pathfinder/PathfinderPlayTest',
  component: Bound,
  args: { onBack: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

const dot = (canvasElement: HTMLElement, row: number, col: number): HTMLElement => within(canvasElement).getByRole('button', { name: new RegExp(`row ${String(row)}, column ${String(col)}(,|$)`) })

export const SolveIt: Story = {
  play: async ({ canvasElement }) => {
    for (const [row, col] of [
      [1, 1],
      [1, 2],
      [2, 2],
      [2, 1],
    ] as const) {
      await userEvent.pointer({ keys: '[MouseLeft]', target: dot(canvasElement, row, col) })
    }
    await expect(within(canvasElement).getByText('Every dot connected! 🎉')).toBeVisible()
  },
}

export const RejectedMove: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.pointer({ keys: '[MouseLeft]', target: dot(canvasElement, 1, 1) })
    await userEvent.pointer({ keys: '[MouseLeft]', target: dot(canvasElement, 2, 2) })
    await expect(within(canvasElement).getByText(/Only in a straight line/)).toBeVisible()
  },
}

export const Back: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Back to Builder' }))
    await expect(args.onBack).toHaveBeenCalledTimes(1)
  },
}
