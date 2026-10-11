import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { PrimShape } from './prim_shape.pure.ui.tsx'
import { unitConeGeometry, unitSphereGeometry, unitTorusGeometry } from './shared_geometry.pure.lib.ts'

async function sceneReady(canvasElement: HTMLElement): Promise<void> {
  const frame = within(canvasElement).getByRole('figure', { name: '3D scene' })
  await waitFor(
    async () => {
      await expect(frame.dataset['sceneReady']).toBe('true')
    },
    { timeout: 10000 },
  )
}

function Stage(): ReactElement {
  return <SceneStoryFrame camera={[0, 2.5, 4]}><PrimShape geometry={unitConeGeometry} color="#E8573F" position={[-1, 0.5, 0]} /><PrimShape geometry={unitSphereGeometry} color="#FFC94A" emissive="#FF9900" emissiveIntensity={0.6} position={[0, 0.5, 0]} /><PrimShape geometry={unitTorusGeometry} color="#8FA8FF" position={[1, 0.5, 0]} /></SceneStoryFrame>
}

const meta = { title: 'app/science_fair/PrimShape', component: Stage } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await sceneReady(canvasElement)
  },
}
