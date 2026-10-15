import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { DEFAULT_LANES } from '@app/arena/lane_navigation.pure.lib.ts'
import { ScienceFairEnvironment } from './science_fair_environment.pure.ui.tsx'

function Stage(): ReactElement {
  return <SceneStoryFrame camera={[0, 1.55, 3]}><ScienceFairEnvironment lanes={DEFAULT_LANES} reducedMotion={false} onBlockedShot={() => undefined} /></SceneStoryFrame>
}

const meta = { title: 'app/science_fair/ScienceFairEnvironment', component: Stage } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
