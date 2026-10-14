import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { GearPreview } from './gear_preview.pure.ui.tsx'
import { symbolEmblemUrl } from './horde_looks.pure.lib.ts'

const meta = {
  title: 'app/horde/GearPreview',
  component: GearPreview,
  args: { look: { skinId: 'steel_suit', armTint: null, armorColor: '#5CA8E6', blasterTint: null, emblem: null, billboardUrl: null } },
} satisfies Meta<typeof GearPreview>

export default meta
type Story = StoryObj<typeof meta>

const shows = async ({ canvasElement }: { readonly canvasElement: HTMLElement }): Promise<void> => {
  await expect(within(canvasElement).getByRole('img', { name: 'Your gear' })).toBeVisible()
}

export const Plain: Story = { play: shows }

/** Glowing pink suit paint, a mint blaster, and a rocket emblem on both. */
export const Designed: Story = {
  args: {
    look: {
      skinId: 'steel_suit',
      armTint: { color: '#EC407A', amount: 0.55, glow: 0.6 },
      armorColor: '#EC407A',
      blasterTint: { color: '#2EE6A8', amount: 0.7, glow: 0.12 },
      emblem: { imageUrl: symbolEmblemUrl('rocket', '#7E57C2'), ringColor: '#7E57C2', onArm: true, onBlaster: true },
      billboardUrl: null,
    },
  },
  play: shows,
}
