import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ALL_LEVELS } from './pathfinder_levels.pure.lib.ts'
import { fakePathfinderScreens } from './pathfinder_screens.test.ui.tsx'
import { solvePuzzle } from './pathfinder_solver.pure.lib.ts'

interface BoundProps {
  readonly serverDown: boolean
  readonly onBack: () => void
}

/** The whole game over an in-memory server: a fresh profile, every screen bound to fakes. */
function Bound({ serverDown, onBack }: BoundProps): ReactElement {
  const [{ Pathfinder }] = useState(() => {
    const screens = fakePathfinderScreens()
    screens.server.failing = serverDown
    return screens
  })
  return <Pathfinder profileId={1} profileName="Mia" onBack={onBack} />
}

const meta = {
  title: 'app/pathfinder/Pathfinder',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { serverDown: false, onBack: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const SolveTheFirstLevel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const first = ALL_LEVELS[0]
    if (first === undefined) return
    await userEvent.click(await canvas.findByRole('button', { name: first.name ?? first.id }))
    for (const pos of solvePuzzle(first).path ?? []) {
      await userEvent.pointer({ keys: '[MouseLeft]', target: canvas.getByRole('button', { name: new RegExp(`row ${String(pos.row + 1)}, column ${String(pos.col + 1)}(,|$)`) }) })
    }
    await expect(canvas.getByText(/Every dot connected/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Next Level' })).toBeVisible()
  },
}

export const ServerDown: Story = {
  args: { serverDown: true },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('alert')).toHaveTextContent(/Couldn't load your progress/)
  },
}
