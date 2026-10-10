import type { ReactElement } from 'react'
import type { Todo, TodoId } from './todo_state.pure.lib.ts'

export interface TodoRowProps {
  readonly todo: Todo
  readonly onToggle: (id: TodoId) => void
  readonly onRemove: (id: TodoId) => void
}

/** One row. Props only: same props, same output. Every control has an accessible name. */
export function TodoRow({ todo, onToggle, onRemove }: TodoRowProps): ReactElement {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ flex: 1, textDecoration: todo.done ? 'line-through' : 'none' }}>
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => {
            onToggle(todo.id)
          }}
        />{' '}
        {todo.title}
      </label>
      <button
        type="button"
        aria-label={`Remove "${todo.title}"`}
        onClick={() => {
          onRemove(todo.id)
        }}
      >
        Remove
      </button>
    </li>
  )
}
