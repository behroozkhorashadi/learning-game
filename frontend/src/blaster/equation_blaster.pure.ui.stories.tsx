import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { EquationBlaster } from './equation_blaster.pure.ui.tsx'
import { MEGA_BLASTER, RAPID_BLASTER, STARTER_BLASTER, type WeaponDefinition } from './weapon_definitions.pure.lib.ts'

async function sceneReady(canvasElement: HTMLElement): Promise<void> {
  const frame = within(canvasElement).getByRole('figure', { name: '3D scene' })
  await waitFor(
    async () => {
      await expect(frame.dataset['sceneReady']).toBe('true')
    },
    { timeout: 10000 },
  )
}

/** The first-person blaster on its own, with a Fire button that bumps the recoil signal. */
function Stage({ onReloadStart, weapon = STARTER_BLASTER, armTint = null }: { readonly onReloadStart: () => void; readonly weapon?: WeaponDefinition; readonly armTint?: { readonly color: string; readonly amount: number; readonly glow: number } | null }): ReactElement {
  const [shots, setShots] = useState(0)
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setShots((n) => n + 1)
        }}
      >
        Fire
      </button>
      <span role="status">{`${String(shots)} fired`}</span>
      <SceneStoryFrame>
        <EquationBlaster
          weapon={weapon}
          armTint={armTint}
          weaponPhase="readyFirstShot"
          cockingUntilMs={null}
          elapsedMs={0}
          cockingMs={weapon.cockingMs}
          recoilSignal={shots}
          aimNdc={{ x: 0.2, y: 0.1 }}
          reducedMotion={false}
          onReloadStart={onReloadStart}
        />
      </SceneStoryFrame>
    </div>
  )
}

const meta = { title: 'app/blaster/EquationBlaster', component: Stage, args: { onReloadStart: fn() } } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

async function fireOnce({ canvasElement }: { readonly canvasElement: HTMLElement }): Promise<void> {
  await sceneReady(canvasElement)
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Fire' }))
  await waitFor(async () => {
    await expect(within(canvasElement).getByRole('status').textContent).toBe('1 fired')
  })
}

export const Fires: Story = { play: fireOnce }

/** The Rapid Blaster: cyan rails, a scope, a cyan flash. */
export const Rapid: Story = { args: { weapon: RAPID_BLASTER }, play: fireOnce }

/** The Mega Blaster: glowing rings, gold power cores, a big pink flash. */
export const Mega: Story = { args: { weapon: MEGA_BLASTER }, play: fireOnce }

/** Zombie Horde's Gold Suit armor skin: both arms tinted gold, with a soft glow. */
export const GoldArmorArms: Story = { args: { armTint: { color: '#D4A017', amount: 0.6, glow: 0.3 } }, play: fireOnce }
