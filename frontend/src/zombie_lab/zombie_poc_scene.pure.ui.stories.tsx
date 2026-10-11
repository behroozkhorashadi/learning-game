import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ZombiePOCScene } from './zombie_poc_scene.pure.ui.tsx'

const meta = { title: 'app/zombie_lab/ZombiePOCScene', component: ZombiePOCScene, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof ZombiePOCScene>

export default meta
type Story = StoryObj<typeof meta>

export const SwitchClip: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'approach' }))
    await expect(canvas.getByRole('button', { name: 'approach' })).toHaveAttribute('aria-pressed', 'true')
  },
}
