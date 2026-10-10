import { describe, expect, it } from 'vitest'
import { bindTodoRepository, type KeyValueStorage } from './todo_repository.effect.lib.ts'
import { toTodoId } from './todo_state.pure.lib.ts'

function fakeStorage(initial: Readonly<Record<string, string>> = {}): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) }
}

describe('bindTodoRepository', () => {
  it('round-trips a saved list', () => {
    const storage = fakeStorage()
    const repository = bindTodoRepository({ storage, key: 'k' })
    const todos = [{ id: toTodoId('a'), title: 'Feed the cat', done: true }]
    repository.save(todos)
    expect(repository.load()).toEqual(todos)
  })

  it('hydrates an empty list when nothing is stored', () => {
    expect(bindTodoRepository({ storage: fakeStorage(), key: 'k' }).load()).toEqual([])
  })

  it.each([
    ['not JSON', '{oops'],
    ['the wrong shape', JSON.stringify({ todos: [] })],
    ['a missing field', JSON.stringify([{ id: 'a', title: 'x' }])],
    ['an empty id', JSON.stringify([{ id: '', title: 'x', done: false }])],
  ])('hydrates an empty list from %s instead of crashing', (_label, stored) => {
    expect(bindTodoRepository({ storage: fakeStorage({ k: stored }), key: 'k' }).load()).toEqual([])
  })

  it('only touches its own key', () => {
    const storage = fakeStorage({ other: 'keep' })
    bindTodoRepository({ storage, key: 'k' }).save([])
    expect(storage.data.get('other')).toBe('keep')
  })
})
