import { describe, expect, it } from 'vitest'
import { IDLE, describeStatus, failed, saved, saving } from './todo_backup_status.pure.lib.ts'

describe('backup status', () => {
  it('describes every state for the status line', () => {
    expect(describeStatus(IDLE)).toBe('Not backed up yet')
    expect(describeStatus(saving())).toBe('Backing up…')
    expect(describeStatus(saved(1))).toBe('Backed up 1 todo')
    expect(describeStatus(saved(3))).toBe('Backed up 3 todos')
    expect(describeStatus(failed('HTTP 500'))).toBe('Backup failed: HTTP 500')
  })
})
