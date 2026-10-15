import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { createRound } from './horde_engine.pure.lib.ts'
import { COVER } from './horde_field.pure.lib.ts'
import { HordeViewport } from './horde_viewport.pure.ui.tsx'

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'],
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
    impacts: [],
    impactStyle: 'spark',
    elapsedMs: 0,
    cover: COVER,
    shadows: true,
    weapon: STARTER_BLASTER,
    armTint: null,
    blasterTint: null,
    emblem: null,
    billboardUrl: null,
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

export const Default: Story = {}

export const ArmedGrenadeLandsOnTheFloor: Story = {
  args: { grenadeArmed: true },
}
