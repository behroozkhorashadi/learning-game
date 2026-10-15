import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { fn } from 'storybook/test'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import type { Carrier } from '@app/zombies/zombie_wave_engine.pure.lib.ts'
import { OutbreakScene } from './outbreak_scene.pure.ui.tsx'
import { SceneStoryFrame } from './scene_story_frame.test.ui.tsx'

const CARRIERS: readonly Carrier[] = [6, 7, 8, 5].map((value, lane) => ({ id: `c${String(lane)}`, label: String(value), correct: value === 7, lane, distance: 0.35 + lane * 0.1, status: 'active', defeatedBy: null }))

function Stage({ debugLanes, onZombieReady }: { readonly debugLanes: boolean; readonly onZombieReady: (id: string) => void }): ReactElement {
  return (
    <SceneStoryFrame height={480}>
      <OutbreakScene
        carriers={CARRIERS}
        charactersByLane={ZOMBIE_CHARACTER_REGISTRY.slice(0, 4)}
        weapon={STARTER_BLASTER}
        phase="playing"
        speedMultiplier={1}
        aimNdc={{ x: 0.1, y: 0 }}
        reducedMotion={false}
        recoilSignal={0}
        weaponPhase="readyFirstShot"
        cockingUntilMs={null}
        elapsedMs={0}
        cockingMs={STARTER_BLASTER.cockingMs}
        onHit={fn()}
        onMiss={fn()}
        onReloadStart={fn()}
        debugLanes={debugLanes}
        onZombieReady={onZombieReady}
      />
    </SceneStoryFrame>
  )
}

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'],
  title: 'app/arena/OutbreakScene',
  component: Stage,
  parameters: { layout: 'fullscreen' },
  args: { debugLanes: false, onZombieReady: fn() },
} satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLaneDebug: Story = { args: { debugLanes: true } }
