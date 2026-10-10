import type { ComponentType } from 'react'
import { assembleTodos } from '@app/examples/todo/todo.assembly.main.ts'

/**
 * Composition root for new-style screens reachable from the legacy shell's
 * `?screen=` dev picker. Each entry is assembled once, when the picker asks
 * for it. As screens migrate (MIGRATION.md), the legacy App shell moves here too.
 */
export function assembleDevScreens(): Readonly<Record<string, { readonly label: string; readonly assemble: () => ComponentType }>> {
  return {
    'todo-example': { label: 'Worked example: todos (add ?flags=examples_todo_backup for backup)', assemble: assembleTodos },
  }
}
