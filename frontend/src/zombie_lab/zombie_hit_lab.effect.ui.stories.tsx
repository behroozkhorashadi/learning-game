import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { fn } from 'storybook/test'
import { bindZombieHitLab } from './zombie_hit_lab.effect.ui.tsx'

/** The real bound lab over in-memory storage and a fake fixture endpoint, in a real browser (real WebGL, the real models). */
function Bound({ appendToTestSet }: { readonly appendToTestSet: () => Promise<{ readonly added: number; readonly total: number }> }): ReactElement {
  const [ZombieHitLab] = useState(() => {
    let saved: string | null = null
    let ids = 0
    return bindZombieHitLab({
      search: '?lane=1&distance=0.5&pose=0.5',
      storage: {
        load: () => saved,
        save: (text) => {
          saved = text
        },
      },
      appendToTestSet,
      download: () => undefined,
      keys: () => () => undefined,
      clock: {
        now: () => performance.now(),
        // Only Re-score waits on the clock, and this story doesn't run it.
        wait: () => Promise.resolve(),
        defer: (run) => {
          queueMicrotask(run)
        },
      },
      createShotId: () => `shot-${String(++ids)}`,
      today: () => '2026-10-10',
    })
  })
  return <ZombieHitLab />
}

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'],
  title: 'app/zombie_lab/ZombieHitLab',
  component: Bound,
  parameters: { layout: 'fullscreen' },
  args: { appendToTestSet: fn(() => Promise.resolve({ added: 0, total: 0 })) },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
