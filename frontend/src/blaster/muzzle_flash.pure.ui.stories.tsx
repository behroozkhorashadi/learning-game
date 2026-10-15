import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { MuzzleFlash } from './muzzle_flash.pure.ui.tsx'

function Stage({ reducedMotion, color = '#FFFFFF', sizeScale = 1 }: { readonly reducedMotion: boolean; readonly color?: string; readonly sizeScale?: number }): ReactElement {
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
        <MuzzleFlash triggerSignal={shots} reducedMotion={reducedMotion} color={color} sizeScale={sizeScale} />
      </SceneStoryFrame>
    </div>
  )
}

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'], title: 'app/blaster/MuzzleFlash', component: Stage, args: { reducedMotion: false } } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ReducedMotion: Story = { args: { reducedMotion: true } }

/** The Mega Blaster's flash: pink and big. */
export const Mega: Story = {
  args: { color: '#FF9CF9', sizeScale: 1.7 },
}
