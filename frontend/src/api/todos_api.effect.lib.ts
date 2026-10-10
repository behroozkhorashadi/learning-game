import { z } from 'zod'
import type { HttpFetch, HttpResponse } from './http.pure.lib.ts'
import type { components } from './openapi_schema.pure.lib.ts'

/**
 * Adapter for the example todos endpoints. The response types come from the
 * backend's OpenAPI schema (`make gen-api`; CI fails if it drifts), and the
 * body is still parsed with zod here at the door — generated types are a
 * claim about the server, not proof.
 */

type ApiTodo = components['schemas']['Todo']

// `satisfies` makes a backend schema change (new required field, renamed field) a compile error here.
const todoSchema = z.object({ id: z.string(), title: z.string(), done: z.boolean() }).readonly() satisfies z.ZodType<ApiTodo>
const todoListSchema = z.array(todoSchema).readonly()

export type TodoRecord = z.infer<typeof todoSchema>

export interface TodosApi {
  readonly list: () => Promise<readonly TodoRecord[]>
  readonly replaceAll: (todos: readonly TodoRecord[]) => Promise<readonly TodoRecord[]>
}

const PATH = '/api/examples/todos'

export function bindTodosApi({ fetch, baseUrl }: { readonly fetch: HttpFetch; readonly baseUrl: string }): TodosApi {
  async function parsed(response: HttpResponse, what: string): Promise<readonly TodoRecord[]> {
    if (!response.ok) throw new Error(`${what} failed with HTTP ${String(response.status)}`)
    const result = todoListSchema.safeParse(await response.json())
    if (!result.success) throw new Error(`${what} returned an unexpected body: ${result.error.message}`)
    return result.data
  }

  return {
    list: async () => parsed(await fetch(`${baseUrl}${PATH}`, { method: 'GET', headers: { Accept: 'application/json' } }), `GET ${PATH}`),
    replaceAll: async (todos) =>
      parsed(
        await fetch(`${baseUrl}${PATH}`, {
          method: 'PUT',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(todos.map(({ id, title, done }) => ({ id, title, done }))),
        }),
        `PUT ${PATH}`,
      ),
  }
}
