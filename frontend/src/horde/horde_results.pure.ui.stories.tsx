import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { HordeResults } from './horde_results.pure.ui.tsx'

const meta = {
  title: 'app/horde/HordeResults',
  component: HordeResults,
  args: {
    outcome: 'survived',
    beatClock: true,
    lastedMs: 74_000,
    newBest: false,
    lines: [
      { label: 'Right answers', count: 11, points: 55 },
      { label: 'Zombies defeated', count: 5, points: 75 },
      { label: 'Headshots', count: 3, points: 15 },
      { label: 'Held out 60 seconds', count: 1, points: 50 },
      { label: 'Lives left at the clock', count: 2, points: 20 },
      { label: 'Overtime seconds', count: 14, points: 28 },
    ],
    points: 243,
    bank: { kind: 'saved', balance: 340 },
    solved: [
      { summary: '3 + 4 = 7', timeMs: 2100 },
      { summary: '8 − 3 = 5', timeMs: 3300 },
      { summary: '6 + 6 = 12', timeMs: 1900 },
    ],
    armor: { reflected: 2, blocked: 1, healed: 0, hearts: 2.5 },
    missed: [],
    onPlayAgain: fn(),
    onBack: fn(),
  },
} satisfies Meta<typeof HordeResults>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Overrun: Story = {
  args: { outcome: 'overrun', beatClock: false, lastedMs: 38_000, lines: [{ label: 'Right answers', count: 2, points: 10 }], points: 10, bank: { kind: 'saving' }, solved: [] },
}

export const NewBestInOvertime: Story = {
  args: {
    outcome: 'overrun',
    lastedMs: 112_000,
    newBest: true,
    lines: [
      { label: 'Right answers', count: 18, points: 180 },
      { label: 'Held out 60 seconds', count: 1, points: 50 },
      { label: 'Lives left at the clock', count: 3, points: 30 },
      { label: 'Overtime seconds', count: 52, points: 104 },
      { label: 'New personal best', count: 1, points: 100 },
    ],
    points: 464,
    solved: [
      { summary: 'x + 4 = 9, so x = 5', timeMs: 3100 },
      { summary: '20 ÷ x = 5, so x = 4', timeMs: 4200 },
    ],
  },
}

export const SaveFailed: Story = {
  args: { bank: { kind: 'failed', message: 'POST /api/profiles/1/armory/rounds failed with HTTP 500' } },
}

export const FactsToPractice: Story = {
  args: {
    missed: [
      { summary: '7 × 8 = 56', timeMs: 6000 },
      { summary: '9 × 6 = 54', timeMs: 4100 },
    ],
  },
}
