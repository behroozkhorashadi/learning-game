import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { DEFAULT_LANES, positionAlongLane } from './lane_navigation.pure.lib.ts'
import { LaneDebugOverlay } from './lane_debug_overlay.pure.ui.tsx'
import { SceneStoryFrame } from './scene_story_frame.test.ui.tsx'

function Stage(): ReactElement {
  const lane = DEFAULT_LANES[1] ?? DEFAULT_LANES[0]
  return (
    <SceneStoryFrame camera={[0, 9, 4]} fov={60}>
      <LaneDebugOverlay lanes={DEFAULT_LANES} activeCarrierPositions={lane === undefined ? [] : [{ lane: 1, position: positionAlongLane(lane, 0.5) }]} />
    </SceneStoryFrame>
  )
}

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'], title: 'app/arena/LaneDebugOverlay', component: Stage } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
