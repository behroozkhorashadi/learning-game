import type { Meta, StoryObj } from '@storybook/react-vite'
import { ZombiePOCScene } from './zombie_poc_scene.pure.ui.tsx'

const meta = {
  // Real WebGL: look at it in Storybook (`npm run storybook`); too heavy to run as a test.
  tags: ['!test'], title: 'app/zombie_lab/ZombiePOCScene', component: ZombiePOCScene, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof ZombiePOCScene>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
