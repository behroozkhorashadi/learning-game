import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { OutbreakViewport } from './outbreak_viewport.pure.ui.tsx'

const meta = {
  title: 'app/arena/OutbreakViewport',
  component: OutbreakViewport,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: 480 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    shadows: true,
    onSceneError: fn(),
    carriers: [{ id: 'c1', label: '7', correct: true, lane: 1, distance: 0.4, status: 'active', defeatedBy: null }],
    charactersByLane: ZOMBIE_CHARACTER_REGISTRY.slice(0, 4),
    weapon: STARTER_BLASTER,
    phase: 'playing',
    speedMultiplier: 1,
    aimNdc: null,
    reducedMotion: false,
    recoilSignal: 0,
    weaponPhase: 'readyFirstShot',
    cockingUntilMs: null,
    elapsedMs: 0,
    cockingMs: STARTER_BLASTER.cockingMs,
    onHit: fn(),
    onMiss: fn(),
    onReloadStart: fn(),
  },
} satisfies Meta<typeof OutbreakViewport>

export default meta
type Story = StoryObj<typeof meta>

export const ClickingNothingIsAMiss: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = canvasElement.querySelector('canvas')
    if (canvas === null) throw new Error('expected a canvas')
    await waitFor(async () => {
      await expect(within(canvasElement).getByText('7')).toBeVisible()
    }, { timeout: 10000 })
    // The top-left corner is ceiling: nothing to hit.
    await userEvent.pointer({ keys: '[MouseLeft]', target: canvas, coords: { offsetX: 4, offsetY: 4 } })
    await waitFor(async () => {
      await expect(args.onMiss).toHaveBeenCalled()
    })
    await expect(args.onSceneError).not.toHaveBeenCalled()
  },
}
