import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { EquationBlaster } from './equation_blaster.pure.ui.tsx'
import { STARTER_BLASTER } from './weapon_definitions.pure.lib.ts'

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
function Stage({ onReloadStart }: { readonly onReloadStart: () => void }): ReactElement {
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
          weapon={STARTER_BLASTER}
          weaponPhase="readyFirstShot"
          cockingUntilMs={null}
          elapsedMs={0}
          cockingMs={STARTER_BLASTER.cockingMs}
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

export const Fires: Story = {
  play: async ({ canvasElement }) => {
    await sceneReady(canvasElement)
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Fire' }))
    await waitFor(async () => {
      await expect(within(canvasElement).getByRole('status').textContent).toBe('1 fired')
    })
  },
}
