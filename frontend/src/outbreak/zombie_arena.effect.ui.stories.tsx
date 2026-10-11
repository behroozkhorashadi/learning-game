import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { OutbreakViewport } from '@app/arena/outbreak_viewport.pure.ui.tsx'
import { arenaHarness, FakeViewport } from './arena_fakes.test.ui.tsx'
import { assembleArenaScheduler } from './zombie_math_blaster.assembly.main.ts'

/**
 * The real bound arena over fake items and audio, on the browser's real
 * clock. `Real3D` uses the real WebGL viewport.
 */
function Bound({ real3d, onBack }: { readonly real3d: boolean; readonly onBack: () => void }): ReactElement {
  const [harness] = useState(() => arenaHarness({ Viewport: real3d ? OutbreakViewport : FakeViewport, scheduler: assembleArenaScheduler(), approachMs: 30000 }))
  return <harness.ZombieArena profileId={1} onBack={onBack} />
}

const meta = {
  title: 'app/outbreak/ZombieArena',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { real3d: false, onBack: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const StartAndZapTheAnswer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Start' }))
    await expect(await canvas.findByRole('heading', { name: 'Question' })).toHaveTextContent('3 + 4 =')
    // The wave spawns after the 1.1s intro beat.
    await userEvent.click(await canvas.findByRole('button', { name: 'Zap the zombie carrying 7' }, { timeout: 3000 }))
    await expect(canvas.getByText('Correct! 3 + 4 = 7')).toBeInTheDocument()
  },
}

export const WrongAnswerCocks: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Start' }))
    await canvas.findByRole('heading', { name: 'Question' })
    await userEvent.click(await canvas.findByRole('button', { name: 'Zap the zombie carrying 6' }, { timeout: 3000 }))
    await expect(canvas.getByRole('status', { name: 'Cocking the blaster' })).toBeVisible()
  },
}

export const Real3D: Story = { args: { real3d: true } }
