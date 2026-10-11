import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { WeaponPOCScene } from './weapon_poc_scene.pure.ui.tsx'

const meta = { title: 'app/zombie_lab/WeaponPOCScene', component: WeaponPOCScene, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof WeaponPOCScene>

export default meta
type Story = StoryObj<typeof meta>

export const SwitchAsset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Right arm' }))
    await expect(canvas.getByRole('button', { name: 'Right arm' })).toHaveAttribute('aria-pressed', 'true')
  },
}
