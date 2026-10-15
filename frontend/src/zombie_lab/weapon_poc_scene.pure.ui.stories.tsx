import type { Meta, StoryObj } from '@storybook/react-vite'
import { WeaponPOCScene } from './weapon_poc_scene.pure.ui.tsx'

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'], title: 'app/zombie_lab/WeaponPOCScene', component: WeaponPOCScene, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof WeaponPOCScene>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
