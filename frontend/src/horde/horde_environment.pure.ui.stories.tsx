import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { HordeEnvironment } from './horde_environment.pure.ui.tsx'
import { CAMERA_POSITION, COVER } from './horde_field.pure.lib.ts'

function Stage(): ReactElement {
  return (
    <SceneStoryFrame camera={CAMERA_POSITION} fov={56} height={480}>
      <HordeEnvironment cover={COVER} shadows />
    </SceneStoryFrame>
  )
}

const meta = {
  title: 'app/horde/HordeEnvironment',
  component: Stage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const TheField: Story = {
  play: async ({ canvasElement }) => {
    const frame = within(canvasElement).getByRole('figure', { name: '3D scene' })
    await waitFor(
      async () => {
        await expect(frame.dataset['sceneReady']).toBe('true')
      },
      { timeout: 10000 },
    )
  },
}
