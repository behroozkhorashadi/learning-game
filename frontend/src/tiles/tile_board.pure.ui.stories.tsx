import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TileBoard } from './tile_board.pure.ui.tsx'

const meta = {
  title: 'app/tiles/TileBoard',
  component: TileBoard,
  args: {
    item: {
      kind: 'word',
      instruction: 'Put the sounds in order to build the word',
      spoken: 'tomato',
      slots: 3,
      answer: ['to', 'ma', 'to'],
      tiles: [
        { id: 'ma-0', label: 'ma' },
        { id: 'to-1', label: 'to' },
        { id: 'to-2', label: 'to' },
      ],
    },
    onResult: fn(),
    onSpeak: fn(),
  },
} satisfies Meta<typeof TileBoard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Embedded: Story = { args: { embedded: true } }
