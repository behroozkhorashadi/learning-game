import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
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

export const Default: Story = {}

export const Real3D: Story = { args: { real3d: true }, tags: ['!test'] }
