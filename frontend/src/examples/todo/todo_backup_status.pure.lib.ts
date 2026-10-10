import type { BackupStatus } from './todo_state.pure.lib.ts'

/**
 * The backup status machine: idle → saving → saved | failed. Always
 * synchronous; the async work lives in todo_backup.effect.lib.ts, which only
 * calls these through bound commands.
 */

export const IDLE: BackupStatus = { kind: 'idle' }

export function saving(): BackupStatus {
  return { kind: 'saving' }
}

export function saved(count: number): BackupStatus {
  return { kind: 'saved', count }
}

export function failed(message: string): BackupStatus {
  return { kind: 'failed', message }
}

export function describeStatus(status: BackupStatus): string {
  switch (status.kind) {
    case 'idle':
      return 'Not backed up yet'
    case 'saving':
      return 'Backing up…'
    case 'saved':
      return `Backed up ${status.count} ${status.count === 1 ? 'todo' : 'todos'}`
    case 'failed':
      return `Backup failed: ${status.message}`
    default:
      return assertNever(status)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled backup status: ${JSON.stringify(value)}`)
}
