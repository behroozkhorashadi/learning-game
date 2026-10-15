import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { fn } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { MEGA_BLASTER, STARTER_BLASTER, type WeaponDefinition } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import type { ImpactStyle } from './horde_armory.pure.lib.ts'
import { createRound, type HordeZombie, type Impact, type Posture } from './horde_engine.pure.lib.ts'
import { COVER } from './horde_field.pure.lib.ts'
import { HordeScene } from './horde_scene.pure.ui.tsx'

/** A frozen moment of a round: one zombie walking, one hiding, one knocked down, one dodging, plus a thrown object and a grenade blast. */
const BASE = createRound({ seed: 5, lives: 3, grenades: 1, shoves: 3, ammo: 0, cover: COVER }).zombies
const POSES: readonly { readonly posture: Posture; readonly x: number; readonly depth: number; readonly health: number }[] = [
  { posture: 'advancing', x: -1.5, depth: 6, health: 100 },
  { posture: 'hiding', x: 3.3, depth: 9.8, health: 50 },
  { posture: 'downed', x: 1.2, depth: 8, health: 66 },
  { posture: 'dodging', x: -3, depth: 12, health: 100 },
]
const ZOMBIES: readonly HordeZombie[] = BASE.map((zombie, i) => ({ ...zombie, ...POSES[i], postureUntilMs: 1e9 }))

interface StageProps {
  readonly onShot: () => void
  readonly onZombieReady: (id: string) => void
  readonly weapon?: WeaponDefinition
  readonly impacts?: readonly Impact[]
  readonly impactStyle?: ImpactStyle
}

function Stage({ onShot, onZombieReady, weapon = STARTER_BLASTER, impacts = [], impactStyle = 'spark' }: StageProps): ReactElement {
  return (
    <SceneStoryFrame height={520}>
      <HordeScene
        zombies={ZOMBIES}
        answers={['42', '36', '48', '49']}
        characters={ZOMBIE_CHARACTER_REGISTRY.slice(0, 4)}
        projectiles={[{ id: 'p1', fromX: -3, fromDepth: 12, launchedAtMs: 0, landsAtMs: 1100, throwerId: 'z0', reflected: false }]}
        blasts={[{ id: 'b1', x: 2, depth: 13, atMs: 200 }]}
        impacts={impacts}
        impactStyle={impactStyle}
        elapsedMs={450}
        cover={COVER}
        shadows
        weapon={weapon}
        armTint={null}
        blasterTint={null}
        emblem={null}
        billboardUrl={null}
        weaponPhase="readyFirstShot"
        cockingUntilMs={null}
        cockingMs={700}
        recoilSignal={0}
        aimNdc={{ x: 0.05, y: -0.05 }}
        reducedMotion={false}
        grenadeArmed={false}
        onShot={onShot}
        onGrenade={fn()}
        onReloadStart={fn()}
        onZombieReady={onZombieReady}
      />
    </SceneStoryFrame>
  )
}

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'],
  title: 'app/horde/HordeScene',
  component: Stage,
  parameters: { layout: 'fullscreen' },
  args: { onShot: fn(), onZombieReady: fn() },
} satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The Mega Blaster with Explosive Rounds: a fireball on the walking zombie's head, a plain spark (standard round) on the downed one. */
export const MegaExplosiveHit: Story = {
  args: {
    weapon: MEGA_BLASTER,
    impactStyle: 'explosion',
    impacts: [
      { id: 'i1', x: -1.5, depth: 6, zone: 'head', atMs: 250, special: true },
      { id: 'i2', x: 1.2, depth: 8, zone: 'body', atMs: 380, special: false },
    ],
  },
}

/** Armor-piercing rounds: a streak straight through the zombie. */
export const ArmorPiercingHit: Story = {
  args: { impactStyle: 'pierce', impacts: [{ id: 'i1', x: -1.5, depth: 6, zone: 'body', atMs: 300, special: true }] },
}
