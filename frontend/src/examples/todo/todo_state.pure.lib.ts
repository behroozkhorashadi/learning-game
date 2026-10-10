/**
 * The todo feature's contract: its data shapes and the capabilities it needs.
 * Everything else in this folder is written against these types, so a
 * capability added here is a compile error at every assembly point that
 * doesn't provide it.
 */

export type TodoId = string & { readonly __brand: 'TodoId' }

/** The one place a string becomes a TodoId. */
export function toTodoId(raw: string): TodoId {
  return raw as TodoId
}

export interface Todo {
  readonly id: TodoId
  readonly title: string
  readonly done: boolean
}

export type Todos = readonly Todo[]

/** Hydrates and saves the list. Not the live source of truth — the owning component's state is. */
export interface TodoRepository {
  readonly load: () => Todos
  readonly save: (todos: Todos) => void
}

/** Where a backup run is. Driven only by the reducers in todo_backup_status.pure.lib.ts. */
export type BackupStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly count: number }
  | { readonly kind: 'failed'; readonly message: string }

/** The narrow external capability the backup operation needs — not the whole API client. */
export interface TodoBackupRemote {
  readonly replaceAll: (todos: Todos) => Promise<readonly unknown[]>
}

/** Synchronous commands the operation calls; each one applies a reducer to the instance that started the run. */
export interface BackupCommands {
  readonly started: () => void
  readonly succeeded: (count: number) => void
  readonly failed: (message: string) => void
}

/** A backup operation connected to one component instance. */
export interface BackupRun {
  readonly run: (todos: Todos) => Promise<void>
}

export interface TodoBackup {
  readonly connect: (commands: BackupCommands) => BackupRun
}
