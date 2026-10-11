import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { createRound, type HordeZombie, type Posture } from './horde_engine.pure.lib.ts'
import { COVER } from './horde_field.pure.lib.ts'
import { HordeScene } from './horde_scene.pure.ui.tsx'

/** A frozen moment of a round: one zombie walking, one hiding, one knocked down, one dodging, plus a thrown object and a grenade blast. */
const BASE = createRound({ seed: 5, lives: 3, grenades: 1, shoves: 3, cover: COVER }).zombies
const POSES: readonly { readonly posture: Posture; readonly x: number; readonly depth: number; readonly health: number }[] = [
  { posture: 'advancing', x: -1.5, depth: 6, health: 100 },
  { posture: 'hiding', x: 3.3, depth: 9.8, health: 50 },
  { posture: 'downed', x: 1.2, depth: 8, health: 66 },
  { posture: 'dodging', x: -3, depth: 12, health: 100 },
]
const ZOMBIES: readonly HordeZombie[] = BASE.map((zombie, i) => ({ ...zombie, ...POSES[i], postureUntilMs: 1e9 }))

function Stage({ onShot, onZombieReady }: { readonly onShot: () => void; readonly onZombieReady: (id: string) => void }): ReactElement {
  return (
    <SceneStoryFrame height={520}>
      <HordeScene
        zombies={ZOMBIES}
        answers={['42', '36', '48', '49']}
        characters={ZOMBIE_CHARACTER_REGISTRY.slice(0, 4)}
        projectiles={[{ id: 'p1', fromX: -3, fromDepth: 12, launchedAtMs: 0, landsAtMs: 1100 }]}
        blasts={[{ id: 'b1', x: 2, depth: 13, atMs: 200, dud: false }]}
        elapsedMs={450}
        cover={COVER}
        shadows
        weapon={STARTER_BLASTER}
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
  title: 'app/horde/HordeScene',
  component: Stage,
  parameters: { layout: 'fullscreen' },
  args: { onShot: fn(), onZombieReady: fn() },
} satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const MidRound: Story = {
  play: async ({ args, canvasElement }) => {
    const frame = within(canvasElement).getByRole('figure', { name: '3D scene' })
    await waitFor(
      async () => {
        await expect(frame.dataset['sceneReady']).toBe('true')
      },
      { timeout: 10000 },
    )
    await waitFor(async () => {
      await expect(args.onZombieReady).toHaveBeenCalledTimes(4)
    })
    await expect(within(canvasElement).getByText('42')).toBeVisible()
  },
}
