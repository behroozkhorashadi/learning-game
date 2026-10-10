import { useState, type ComponentType, type FormEvent, type ReactElement } from 'react'
import { IDLE, describeStatus, failed, saved, saving } from './todo_backup_status.pure.lib.ts'
import { TodoRow } from './todo.pure.ui.tsx'
import { addTodo, remainingCount, removeTodo, toggleTodo } from './todo_reducers.pure.lib.ts'
import type { BackupStatus, TodoBackup, TodoId, TodoRepository, Todos } from './todo_state.pure.lib.ts'

export interface TodosDeps {
  readonly repository: TodoRepository
  readonly createId: () => TodoId
  /** The backup operation, or null when the `examples_todo_backup` flag is off (assembly decides). */
  readonly backup: TodoBackup | null
}

/**
 * Construction-time capabilities in, a component out. The component owns the
 * list in useState, applies pure reducers in its event handlers, and persists
 * each new snapshot through the injected repository.
 */
export function bindTodos({ repository, createId, backup }: TodosDeps): ComponentType {
  function TodoList(): ReactElement {
    const [todos, setTodos] = useState<Todos>(() => repository.load())
    const [draft, setDraft] = useState('')
    const [status, setStatus] = useState<BackupStatus>(IDLE)
    // Connected once per instance, so a backup's result can only land here.
    const [backupRun] = useState(() =>
      backup === null
        ? null
        : backup.connect({
            started: () => {
              setStatus(saving())
            },
            succeeded: (count) => {
              setStatus(saved(count))
            },
            failed: (message) => {
              setStatus(failed(message))
            },
          }),
    )

    const commit = (next: Todos): void => {
      setTodos(next)
      repository.save(next)
    }

    const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault()
      const next = addTodo(todos, { id: createId(), title: draft })
      if (next === todos) return
      commit(next)
      setDraft('')
    }

    return (
      <section aria-labelledby="todo-example-heading" style={{ padding: 24, maxWidth: 420, fontFamily: 'var(--font-sans)' }}>
        <h2 id="todo-example-heading">Todos</h2>
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8 }}>
          <label htmlFor="todo-example-title">New todo</label>
          <input
            id="todo-example-title"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
            }}
          />
          <button type="submit">Add</button>
        </form>
        <p role="status">{remainingCount(todos)} left</p>
        <ul aria-label="Todo list" style={{ listStyle: 'none', padding: 0 }}>
          {todos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              onToggle={(id) => {
                commit(toggleTodo(todos, id))
              }}
              onRemove={(id) => {
                commit(removeTodo(todos, id))
              }}
            />
          ))}
        </ul>
        {backupRun !== null && (
          <div>
            <button
              type="button"
              disabled={status.kind === 'saving'}
              onClick={() => {
                void backupRun.run(todos)
              }}
            >
              Back up to server
            </button>
            <p aria-live="polite">{describeStatus(status)}</p>
          </div>
        )}
      </section>
    )
  }
  return TodoList
}
