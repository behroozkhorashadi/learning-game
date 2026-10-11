import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { HordeResults } from './horde_results.pure.ui.tsx'

const meta = {
  title: 'app/horde/HordeResults',
  component: HordeResults,
  args: {
    survived: true,
    lines: [
      { label: 'Right answers', count: 11, points: 55 },
      { label: 'Zombies defeated', count: 5, points: 75 },
      { label: 'Headshots', count: 3, points: 15 },
      { label: 'Survived the horde', count: 1, points: 50 },
      { label: 'Lives left', count: 2, points: 20 },
    ],
    points: 215,
    bank: { kind: 'saved', balance: 340 },
    solved: [
      { summary: '3 + 4 = 7', timeMs: 2100 },
      { summary: '8 − 3 = 5', timeMs: 3300 },
      { summary: '6 + 6 = 12', timeMs: 1900 },
    ],
    onPlayAgain: fn(),
    onBack: fn(),
  },
} satisfies Meta<typeof HordeResults>

export default meta
type Story = StoryObj<typeof meta>

export const Survived: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('340 points')
    await userEvent.click(canvas.getByRole('button', { name: 'Play again' }))
    await expect(args.onPlayAgain).toHaveBeenCalled()
  },
}

export const Overrun: Story = {
  args: { survived: false, lines: [{ label: 'Right answers', count: 2, points: 10 }], points: 10, bank: { kind: 'saving' }, solved: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: 'The horde got through!' })).toBeVisible()
  },
}

export const SaveFailed: Story = {
  args: { bank: { kind: 'failed', message: 'POST /api/profiles/1/armory/rounds failed with HTTP 500' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('HTTP 500')
  },
}
