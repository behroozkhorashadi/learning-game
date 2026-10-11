import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { createRound } from './horde_engine.pure.lib.ts'
import { COVER } from './horde_field.pure.lib.ts'
import { HordeViewport } from './horde_viewport.pure.ui.tsx'

const meta = {
  title: 'app/horde/HordeViewport',
  component: HordeViewport,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: 480 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    onSceneError: fn(),
    zombies: createRound({ seed: 9, lives: 3, grenades: 0, shoves: 3, ammo: 0, cover: COVER }).zombies,
    answers: ['6', '7', '8', '5'],
    characters: ZOMBIE_CHARACTER_REGISTRY.slice(0, 4),
    projectiles: [],
    blasts: [],
    elapsedMs: 0,
    cover: COVER,
    shadows: true,
    weapon: STARTER_BLASTER,
    weaponPhase: 'readyFirstShot',
    cockingUntilMs: null,
    cockingMs: 700,
    recoilSignal: 0,
    aimNdc: null,
    reducedMotion: false,
    grenadeArmed: false,
    onShot: fn(),
    onGrenade: fn(),
    onReloadStart: fn(),
  },
} satisfies Meta<typeof HordeViewport>

export default meta
type Story = StoryObj<typeof meta>

export const ClickingTheSkyIsAMiss: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = canvasElement.querySelector('canvas')
    if (canvas === null) throw new Error('expected a canvas')
    await waitFor(
      async () => {
        await expect(within(canvasElement).getByText('7')).toBeVisible()
      },
      { timeout: 10000 },
    )
    await userEvent.pointer({ keys: '[MouseLeft]', target: canvas, coords: { offsetX: 4, offsetY: 4 } })
    await waitFor(async () => {
      await expect(args.onShot).toHaveBeenCalledWith(null)
    })
    await expect(args.onSceneError).not.toHaveBeenCalled()
  },
}

export const ArmedGrenadeLandsOnTheFloor: Story = {
  args: { grenadeArmed: true },
  play: async ({ args, canvasElement }) => {
    const canvas = canvasElement.querySelector('canvas')
    if (canvas === null) throw new Error('expected a canvas')
    await waitFor(
      async () => {
        await expect(within(canvasElement).getByText('7')).toBeVisible()
      },
      { timeout: 10000 },
    )
    // Low in the middle of the view is floor.
    await userEvent.pointer({ keys: '[MouseLeft]', target: canvas, coords: { offsetX: canvas.clientWidth / 2, offsetY: canvas.clientHeight - 30 } })
    await waitFor(async () => {
      await expect(args.onGrenade).toHaveBeenCalled()
    })
    await expect(args.onShot).not.toHaveBeenCalled()
  },
}
