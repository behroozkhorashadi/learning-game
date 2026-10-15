import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { EnvironmentProp } from './environment_prop.pure.ui.tsx'
import { PrimShape } from './prim_shape.pure.ui.tsx'
import { unitBoxGeometry } from './shared_geometry.pure.lib.ts'

function Stage(): ReactElement {
  return <SceneStoryFrame camera={[0, 2.5, 4]}><EnvironmentProp placement={{ id: 'demo', kind: 'locker', position: [0, 0.6, 0], rotationY: 0.4, halfExtents: [1, 0.6, 0.3] }} onBlockedShot={() => undefined}><PrimShape geometry={unitBoxGeometry} color="#4A6FA5" scale={[2, 1.2, 0.6]} /></EnvironmentProp></SceneStoryFrame>
}

const meta = { title: 'app/science_fair/EnvironmentProp', component: Stage } satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
