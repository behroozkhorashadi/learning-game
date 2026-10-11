import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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

export const BuildTomato: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const tray = within(canvas.getByRole('group', { name: 'Sound tiles' }))
    for (const name of ['to', 'ma', 'to']) {
      const tile = tray.getAllByRole('button', { name })[0]
      if (tile === undefined) throw new Error(`no ${name} tile`)
      await userEvent.click(tile)
    }
    await userEvent.click(canvas.getByRole('button', { name: /Check it/ }))
    await expect(args.onResult).toHaveBeenCalledWith(expect.objectContaining({ correct: true, value: 'tomato' }))
    await expect(canvas.getByText('You built it!')).toBeVisible()
  },
}

export const WrongOrder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tray = within(canvas.getByRole('group', { name: 'Sound tiles' }))
    for (let i = 0; i < 3; i++) {
      const tile = tray.getAllByRole('button')[0]
      if (tile === undefined) throw new Error('tray emptied early')
      await userEvent.click(tile)
    }
    await userEvent.click(canvas.getByRole('button', { name: /Check it/ }))
    await expect(canvas.getByText('Almost! Take another look.')).toBeVisible()
  },
}

export const Embedded: Story = { args: { embedded: true } }
