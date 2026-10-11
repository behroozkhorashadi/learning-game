import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { DEFAULT_LANES, positionAlongLane } from './lane_navigation.pure.lib.ts'
import { LaneDebugOverlay } from './lane_debug_overlay.pure.ui.tsx'
import { SceneStoryFrame } from './scene_story_frame.test.ui.tsx'

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
  const lane = DEFAULT_LANES[1] ?? DEFAULT_LANES[0]
  return (
    <SceneStoryFrame camera={[0, 9, 4]} fov={60}>
      <LaneDebugOverlay lanes={DEFAULT_LANES} activeCarrierPositions={lane === undefined ? [] : [{ lane: 1, position: positionAlongLane(lane, 0.5) }]} />
    </SceneStoryFrame>
  )
}

const meta = { title: 'app/arena/LaneDebugOverlay', component: Stage } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const LanesAndColliders: Story = {
  play: async ({ canvasElement }) => {
    await sceneReady(canvasElement)
  },
}
