import { describe, expect, it } from 'vitest'
import { addTodo, remainingCount, removeTodo, toggleTodo } from './todo_reducers.pure.lib.ts'
import { toTodoId, type Todos } from './todo_state.pure.lib.ts'

const a = toTodoId('a')
const b = toTodoId('b')
const two: Todos = [
  { id: a, title: 'Feed the cat', done: false },
  { id: b, title: 'Water plants', done: true },
]

describe('addTodo', () => {
  it('appends a trimmed, not-done todo', () => {
    expect(addTodo([], { id: a, title: '  Feed the cat ' })).toEqual([{ id: a, title: 'Feed the cat', done: false }])
  })

  it('returns the same snapshot for a blank title, so callers can skip saving', () => {
    const before: Todos = []
    expect(addTodo(before, { id: a, title: '   ' })).toBe(before)
  })

  it('never mutates its input', () => {
    const before: Todos = [...two]
    addTodo(before, { id: toTodoId('c'), title: 'New' })
    expect(before).toEqual(two)
  })
})

describe('toggleTodo / removeTodo', () => {
  it('flips only the matching todo', () => {
    expect(toggleTodo(two, a).map((t) => t.done)).toEqual([true, true])
  })

  it('removes only the matching todo', () => {
    expect(removeTodo(two, a).map((t) => t.id)).toEqual([b])
  })
})

describe('remainingCount', () => {
  it('counts todos that are not done', () => {
    expect(remainingCount(two)).toBe(1)
  })
})
