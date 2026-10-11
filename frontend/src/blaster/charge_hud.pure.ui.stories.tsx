import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ChargeHud } from './charge_hud.pure.ui.tsx'

const meta = {
  title: 'app/blaster/ChargeHud',
  component: ChargeHud,
  parameters: { backgrounds: { default: 'dark' } },
  args: { shotsRemaining: 2, weaponPhase: 'readyFirstShot', reducedMotion: false },
} satisfies Meta<typeof ChargeHud>

export default meta
type Story = StoryObj<typeof meta>

export const TwoShots: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status', { name: '2 shots left' })).toBeVisible()
  },
}

export const Cocking: Story = {
  args: { shotsRemaining: 1, weaponPhase: 'cocking' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status', { name: 'Cocking the blaster' })).toBeVisible()
  },
}

export const Spent: Story = { args: { shotsRemaining: 0, weaponPhase: 'waveResolved' } }
