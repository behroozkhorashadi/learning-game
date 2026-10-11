import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { ScienceFairBooth } from './science_fair_booth.pure.ui.tsx'

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
  return <SceneStoryFrame camera={[0, 2.5, 4]}><group position={[-1.2, 0, 0]}><ScienceFairBooth subject="volcano" /></group><group position={[0, 0, 0]}><ScienceFairBooth subject="solar_system" /></group><group position={[1.2, 0, 0]}><ScienceFairBooth subject="plants" /></group></SceneStoryFrame>
}

const meta = { title: 'app/science_fair/ScienceFairBooth', component: Stage } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await sceneReady(canvasElement)
  },
}
