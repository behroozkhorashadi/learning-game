import type { ComponentType } from 'react'
import { bindTodosApi } from '@app/api/todos_api.effect.lib.ts'
import { bindFeatureFlags } from '@app/flags/feature_flags.effect.lib.ts'
import { bindTodoBackup } from './todo_backup.effect.lib.ts'
import { bindTodoRepository } from './todo_repository.effect.lib.ts'
import { toTodoId } from './todo_state.pure.lib.ts'
import { bindTodos } from './todos.effect.ui.tsx'

/**
 * The only place the todo feature touches the real world: it reads the
 * ambient globals (localStorage, crypto, fetch, location), reads the flag,
 * picks implementations, and injects narrow handles. Called once, from a
 * composition root — never at module scope.
 */
export function assembleTodos(): ComponentType {
  const flags = bindFeatureFlags({ search: window.location.search })
  const repository = bindTodoRepository({
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => {
        localStorage.setItem(key, value)
      },
    },
    key: 'examples.todo.v1',
  })
  const api = bindTodosApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindTodos({
    repository,
    createId: () => toTodoId(crypto.randomUUID()),
    backup: flags.isEnabled('examples_todo_backup') ? bindTodoBackup({ remote: { replaceAll: api.replaceAll } }) : null,
  })
}
