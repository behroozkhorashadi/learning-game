import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { bindTodoBackup } from './todo_backup.effect.lib.ts'
import { toTodoId, type Todos } from './todo_state.pure.lib.ts'
import { bindTodos } from './todos.effect.ui.tsx'

type BackupMode = 'off' | 'succeeds' | 'fails'

/**
 * The real bound component with fake capabilities and seeded state — no
 * backend, no localStorage. Each story binds its own instance.
 */
function Bound({ seed, backup }: { readonly seed: Todos; readonly backup: BackupMode }): ReactElement {
  const [Todos] = useState(() => {
    let n = 0
    return bindTodos({
      repository: { load: () => seed, save: () => undefined },
      createId: () => toTodoId(`story-${String(++n)}`),
      backup:
        backup === 'off'
          ? null
          : bindTodoBackup({
              remote: {
                replaceAll: (todos) => (backup === 'succeeds' ? Promise.resolve(todos) : Promise.reject(new Error('HTTP 503'))),
              },
            }),
    })
  })
  return <Todos />
}

const meta = {
  title: 'app/examples/todo/Todos',
  component: Bound,
  args: {
    seed: [
      { id: toTodoId('a'), title: 'Feed the cat', done: false },
      { id: toTodoId('b'), title: 'Water plants', done: true },
    ],
    backup: 'off',
  },
} satisfies Meta<typeof Bound>

export default meta
type Story = StoryObj<typeof meta>

export const Seeded: Story = {}

export const Empty: Story = { args: { seed: [] } }

export const AddsATodo: Story = {
  args: { seed: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: 'New todo' }), 'Read a book')
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }))
    await expect(canvas.getByRole('checkbox', { name: 'Read a book' })).not.toBeChecked()
    await expect(canvas.getByRole('status')).toHaveTextContent('1 left')
  },
}

export const BackupSucceeds: Story = {
  args: { backup: 'succeeds' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Back up to server' }))
    await expect(await canvas.findByText('Backed up 2 todos')).toBeVisible()
  },
}

export const BackupFails: Story = {
  args: { backup: 'fails' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Back up to server' }))
    await expect(await canvas.findByText('Backup failed: HTTP 503')).toBeVisible()
  },
}
