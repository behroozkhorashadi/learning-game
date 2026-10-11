import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { assembleArenaScheduler } from '@app/outbreak/zombie_math_blaster.assembly.main.ts'
import { FakeHordeViewport, fakeArmory, hordeHarness } from './horde_fakes.test.ui.tsx'
import { HordeViewport } from './horde_viewport.pure.ui.tsx'

/**
 * The real bound game over fake items, armory, and audio, on the browser's
 * real clock. `Real3D` uses the real WebGL view: play it.
 */
function Bound({ real3d, balance, onBack }: { readonly real3d: boolean; readonly balance: number; readonly onBack: () => void }): ReactElement {
  const [harness] = useState(() => hordeHarness({ Viewport: real3d ? HordeViewport : FakeHordeViewport, scheduler: assembleArenaScheduler(), approachMs: 9000, armory: fakeArmory({ balance, grenades: 3 }) }))
  return <harness.ZombieHorde profileId={1} onBack={onBack} />
}

const meta = {
  title: 'app/horde/ZombieHorde',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { real3d: false, balance: 300, onBack: fn() },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const BuyThenZapTheAnswer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Buy Rapid Blaster for 250 points' }))
    // Bought, so the best gear owned is equipped, and the starter can be swapped back in.
    await expect(await canvas.findByRole('button', { name: 'Equip Starter Blaster' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Start' }))
    await expect(await canvas.findByRole('heading', { name: 'Question' })).toHaveTextContent('3 + 4 =')
    await userEvent.click(await canvas.findByRole('button', { name: 'Zap the zombie carrying 7' }, { timeout: 3000 }))
    await expect(canvas.getByText('Correct! 3 + 4 = 7')).toBeInTheDocument()
  },
}

export const Real3D: Story = { args: { real3d: true } }
