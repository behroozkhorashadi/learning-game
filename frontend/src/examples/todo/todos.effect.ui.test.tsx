import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bindTodoBackup } from './todo_backup.effect.lib.ts'
import { toTodoId, type TodoRepository, type Todos } from './todo_state.pure.lib.ts'
import { bindTodos } from './todos.effect.ui.tsx'

afterEach(cleanup)

/** In-memory repository that records every save, so tests assert what was persisted. */
function memoryRepository(initial: Todos): TodoRepository & { readonly saves: Todos[] } {
  const saves: Todos[] = []
  return { saves, load: () => initial, save: (todos) => void saves.push(todos) }
}

function sequentialIds(): () => ReturnType<typeof toTodoId> {
  let n = 0
  return () => toTodoId(`id-${String(++n)}`)
}

function addTodo(title: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: 'New todo' }), { target: { value: title } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

describe('bindTodos', () => {
  it('hydrates from the repository', () => {
    const Todos = bindTodos({
      repository: memoryRepository([{ id: toTodoId('a'), title: 'Feed the cat', done: false }]),
      createId: sequentialIds(),
      backup: null,
    })
    render(<Todos />)
    expect(screen.getByRole('checkbox', { name: 'Feed the cat' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('1 left')
  })

  it('adds, toggles, and removes — saving each snapshot', () => {
    const repository = memoryRepository([])
    const Todos = bindTodos({ repository, createId: sequentialIds(), backup: null })
    render(<Todos />)

    addTodo('Water plants')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Water plants' }))
    expect(screen.getByRole('status').textContent).toBe('0 left')
    fireEvent.click(screen.getByRole('button', { name: 'Remove "Water plants"' }))

    expect(screen.queryByRole('checkbox', { name: 'Water plants' })).toBeNull()
    expect(repository.saves).toEqual([
      [{ id: 'id-1', title: 'Water plants', done: false }],
      [{ id: 'id-1', title: 'Water plants', done: true }],
      [],
    ])
  })

  it('ignores a blank title and saves nothing', () => {
    const repository = memoryRepository([])
    const Todos = bindTodos({ repository, createId: sequentialIds(), backup: null })
    render(<Todos />)
    addTodo('   ')
    expect(repository.saves).toEqual([])
  })

  it('has no backup control when the flag is off (backup: null)', () => {
    const Todos = bindTodos({ repository: memoryRepository([]), createId: sequentialIds(), backup: null })
    render(<Todos />)
    expect(screen.queryByRole('button', { name: 'Back up to server' })).toBeNull()
  })

  it('shows saving, then saved, for a successful backup', async () => {
    let settle: () => void = () => undefined
    const backup = bindTodoBackup({
      remote: { replaceAll: (todos) => new Promise((resolve) => (settle = () => resolve(todos))) },
    })
    const Todos = bindTodos({ repository: memoryRepository([]), createId: sequentialIds(), backup })
    render(<Todos />)
    addTodo('Feed the cat')

    fireEvent.click(screen.getByRole('button', { name: 'Back up to server' }))
    expect(await screen.findByText('Backing up…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Back up to server' })).toHaveProperty('disabled', true)

    settle()
    expect(await screen.findByText('Backed up 1 todo')).toBeTruthy()
  })

  it('shows the failure when the backup rejects', async () => {
    const backup = bindTodoBackup({ remote: { replaceAll: () => Promise.reject(new Error('HTTP 503')) } })
    const Todos = bindTodos({ repository: memoryRepository([]), createId: sequentialIds(), backup })
    render(<Todos />)
    fireEvent.click(screen.getByRole('button', { name: 'Back up to server' }))
    expect(await screen.findByText('Backup failed: HTTP 503')).toBeTruthy()
  })
})
