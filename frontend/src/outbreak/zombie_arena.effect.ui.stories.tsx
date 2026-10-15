import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
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

export const Default: Story = {}

export const Real3D: Story = { args: { real3d: true }, tags: ['!test'] }
