import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { EnvironmentProp } from './environment_prop.pure.ui.tsx'
import { PrimShape } from './prim_shape.pure.ui.tsx'
import { unitBoxGeometry } from './shared_geometry.pure.lib.ts'

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
  return <SceneStoryFrame camera={[0, 2.5, 4]}><EnvironmentProp placement={{ id: 'demo', kind: 'locker', position: [0, 0.6, 0], rotationY: 0.4, halfExtents: [1, 0.6, 0.3] }} onBlockedShot={() => undefined}><PrimShape geometry={unitBoxGeometry} color="#4A6FA5" scale={[2, 1.2, 0.6]} /></EnvironmentProp></SceneStoryFrame>
}

const meta = { title: 'app/science_fair/EnvironmentProp', component: Stage } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await sceneReady(canvasElement)
  },
}
