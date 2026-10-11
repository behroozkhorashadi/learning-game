import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { SceneStoryFrame } from '@app/arena/scene_story_frame.test.ui.tsx'
import { AnswerLabel3D } from './answer_label_3d.pure.ui.tsx'

function Stage({ label, color, hidden }: { readonly label: string; readonly color: string; readonly hidden: boolean }): ReactElement {
  return (
    <SceneStoryFrame>
      <group position={[0, 1.6, 0]}>
        <AnswerLabel3D label={label} color={color} hidden={hidden} />
      </group>
    </SceneStoryFrame>
  )
}

const meta = {
  title: 'app/zombies/AnswerLabel3D',
  component: Stage,
  args: { label: '12', color: '#144FFF', hidden: false },
} satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

export const Shown: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(within(canvasElement).getByText('12')).toBeVisible()
    })
  },
}

export const Defeated: Story = {
  args: { hidden: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('12')).toBeNull()
  },
}
