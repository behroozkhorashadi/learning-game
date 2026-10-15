import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { EnvironmentCollider } from './environment_collider.pure.ui.tsx'

function Stage(): ReactElement {
  return <SceneStoryFrame camera={[0, 2.5, 4]}><EnvironmentCollider collider={{ id: 'demo', center: [0, 0.5, 0], halfExtents: [0.5, 0.5, 0.5] }} onBlockedShot={() => undefined} /></SceneStoryFrame>
}

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'], title: 'app/science_fair/EnvironmentCollider', component: Stage } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
