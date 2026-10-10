import type { Todo, TodoId, Todos } from './todo_state.pure.lib.ts'

/** Snapshot in, snapshot out. Blank titles are ignored rather than stored. */
export function addTodo(todos: Todos, todo: { readonly id: TodoId; readonly title: string }): Todos {
  const title = todo.title.trim()
  if (title === '') return todos
  const added: Todo = { id: todo.id, title, done: false }
  return [...todos, added]
}

export function toggleTodo(todos: Todos, id: TodoId): Todos {
  return todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
}

export function removeTodo(todos: Todos, id: TodoId): Todos {
  return todos.filter((t) => t.id !== id)
}

export function remainingCount(todos: Todos): number {
  return todos.filter((t) => !t.done).length
}
