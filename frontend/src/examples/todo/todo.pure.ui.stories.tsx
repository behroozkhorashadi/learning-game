import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { TodoRow } from './todo.pure.ui.tsx'
import { toTodoId } from './todo_state.pure.lib.ts'

const meta = {
  title: 'app/examples/todo/TodoRow',
  component: TodoRow,
  args: {
    todo: { id: toTodoId('a'), title: 'Feed the cat', done: false },
    onToggle: fn(),
    onRemove: fn(),
  },
  decorators: [(Story) => <ul style={{ listStyle: 'none', padding: 0 }}>{Story()}</ul>],
} satisfies Meta<typeof TodoRow>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Feed the cat' }))
    await expect(args.onToggle).toHaveBeenCalledWith('a')
  },
}

export const Done: Story = {
  args: { todo: { id: toTodoId('b'), title: 'Water plants', done: true } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('checkbox', { name: 'Water plants' })).toBeChecked()
  },
}
