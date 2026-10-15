import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { HordeZombieLabel } from './horde_zombie_label.pure.ui.tsx'

function Stage({ answer, color, health }: { readonly answer: string | null; readonly color: string; readonly health: number }): ReactElement {
  return (
    <SceneStoryFrame>
      <group position={[0, 1.6, 0]}>
        <HordeZombieLabel answer={answer} color={color} health={health} />
      </group>
    </SceneStoryFrame>
  )
}

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'],
  title: 'app/horde/HordeZombieLabel',
  component: Stage,
  args: { answer: '42', color: '#9D57FA', health: 0.66 },
} satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const BetweenQuestions: Story = {
  args: { answer: null, health: 0.2 },
}
