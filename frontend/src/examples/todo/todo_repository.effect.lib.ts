import { z } from 'zod'
import { toTodoId, type TodoRepository, type Todos } from './todo_state.pure.lib.ts'

/** The narrow slice of Storage this adapter needs — assembly passes localStorage's two methods, tests pass a Map. */
export interface KeyValueStorage {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
}

const storedTodosSchema = z.array(
  z.object({
    id: z.string().min(1).transform(toTodoId),
    title: z.string(),
    done: z.boolean(),
  }),
)

/**
 * Storage is outside the app: whatever is under `key` is `unknown` until it
 * parses. Corrupt or foreign data hydrates as an empty list instead of
 * crashing the screen.
 */
export function bindTodoRepository({ storage, key }: { readonly storage: KeyValueStorage; readonly key: string }): TodoRepository {
  return {
    load: (): Todos => {
      const text = storage.getItem(key)
      if (text === null) return []
      let raw: unknown
      try {
        raw = JSON.parse(text)
      } catch {
        return []
      }
      const parsed = storedTodosSchema.safeParse(raw)
      return parsed.success ? parsed.data : []
    },
    save: (todos: Todos): void => {
      storage.setItem(key, JSON.stringify(todos))
    },
  }
}
