import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { MuzzleFlash } from './muzzle_flash.pure.ui.tsx'

function Stage({ reducedMotion }: { readonly reducedMotion: boolean }): ReactElement {
  const [shots, setShots] = useState(0)
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setShots((n) => n + 1)
        }}
      >
        Flash
      </button>
      <SceneStoryFrame camera={[0, 0, 0.6]}>
        <MuzzleFlash triggerSignal={shots} reducedMotion={reducedMotion} />
      </SceneStoryFrame>
    </div>
  )
}

const meta = { title: 'app/blaster/MuzzleFlash', component: Stage, args: { reducedMotion: false } } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const OnTrigger: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Flash' }))
    await expect(within(canvasElement).getByRole('figure', { name: '3D scene' })).toBeVisible()
  },
}

export const ReducedMotion: Story = { args: { reducedMotion: true } }
