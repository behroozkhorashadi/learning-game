import type { BackupCommands, BackupRun, TodoBackup, TodoBackupRemote, Todos } from './todo_state.pure.lib.ts'

/**
 * The async operation layer: drives idle → saving → saved | failed through
 * synchronous commands. Policy lives here, assembled once:
 *
 * - Results land on the instance that started them: `connect` closes over
 *   that instance's commands, so another screen's backup can't touch it.
 * - Latest wins: if a newer run starts before an older one settles, the
 *   older result is dropped instead of overwriting the newer status.
 */
export function bindTodoBackup({ remote }: { readonly remote: TodoBackupRemote }): TodoBackup {
  return {
    connect: (commands: BackupCommands): BackupRun => {
      let latest = 0
      return {
        run: async (todos: Todos): Promise<void> => {
          latest += 1
          const mine = latest
          commands.started()
          try {
            const stored = await remote.replaceAll(todos)
            if (mine === latest) commands.succeeded(stored.length)
          } catch (error: unknown) {
            if (mine === latest) commands.failed(error instanceof Error ? error.message : 'unknown error')
          }
        },
      }
    },
  }
}
