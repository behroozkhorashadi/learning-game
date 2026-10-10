import { describe, expect, it } from 'vitest'
import { bindTodoBackup } from './todo_backup.effect.lib.ts'
import { toTodoId, type BackupCommands, type Todos } from './todo_state.pure.lib.ts'

/** A remote whose calls settle only when the test says so — so the in-between states are observable. */
function controllableRemote(): {
  readonly remote: { readonly replaceAll: (todos: Todos) => Promise<readonly unknown[]> }
  readonly calls: { readonly todos: Todos; readonly resolve: () => void; readonly reject: (e: Error) => void }[]
} {
  const calls: { todos: Todos; resolve: () => void; reject: (e: Error) => void }[] = []
  return {
    calls,
    remote: {
      replaceAll: (todos) =>
        new Promise((resolve, reject) => {
          calls.push({ todos, resolve: () => resolve(todos), reject })
        }),
    },
  }
}

function recordingCommands(): BackupCommands & { readonly log: string[] } {
  const log: string[] = []
  return {
    log,
    started: () => log.push('started'),
    succeeded: (count) => log.push(`succeeded:${String(count)}`),
    failed: (message) => log.push(`failed:${message}`),
  }
}

const todos: Todos = [{ id: toTodoId('a'), title: 'Feed the cat', done: false }]

describe('bindTodoBackup', () => {
  it('goes saving → saved with the stored count', async () => {
    const { remote, calls } = controllableRemote()
    const commands = recordingCommands()
    const pending = bindTodoBackup({ remote }).connect(commands).run(todos)
    expect(commands.log).toEqual(['started'])
    calls[0]?.resolve()
    await pending
    expect(commands.log).toEqual(['started', 'succeeded:1'])
  })

  it('goes saving → failed with the error message', async () => {
    const { remote, calls } = controllableRemote()
    const commands = recordingCommands()
    const pending = bindTodoBackup({ remote }).connect(commands).run(todos)
    calls[0]?.reject(new Error('HTTP 500'))
    await pending
    expect(commands.log).toEqual(['started', 'failed:HTTP 500'])
  })

  it('drops a stale result when a newer run started first (latest wins)', async () => {
    const { remote, calls } = controllableRemote()
    const commands = recordingCommands()
    const run = bindTodoBackup({ remote }).connect(commands)
    const first = run.run(todos)
    const second = run.run([])
    calls[1]?.resolve()
    await second
    calls[0]?.reject(new Error('late failure'))
    await first
    expect(commands.log).toEqual(['started', 'started', 'succeeded:0'])
  })

  it('reports to the instance that started the run, not another one', async () => {
    const { remote, calls } = controllableRemote()
    const backup = bindTodoBackup({ remote })
    const mine = recordingCommands()
    const other = recordingCommands()
    backup.connect(other)
    const pending = backup.connect(mine).run(todos)
    calls[0]?.resolve()
    await pending
    expect(mine.log).toEqual(['started', 'succeeded:1'])
    expect(other.log).toEqual([])
  })
})
