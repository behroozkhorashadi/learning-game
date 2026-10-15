import type { Meta, StoryObj } from '@storybook/react-vite'
import { WordPicture } from './word_picture.pure.ui.tsx'

const meta = {
  title: 'app/syllable_builder/WordPicture',
  component: WordPicture,
  args: { word: 'no-such-word' },
} satisfies Meta<typeof WordPicture>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
