import type { Meta, StoryObj } from '@storybook/react-vite'
import { IllustrationArt } from './illustration_art.pure.ui.tsx'

const meta = {
  title: 'app/writing/IllustrationArt',
  component: IllustrationArt,
  args: { imageUrl: '', style: 'brightpaper', label: 'Hero illustration' },
} satisfies Meta<typeof IllustrationArt>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
