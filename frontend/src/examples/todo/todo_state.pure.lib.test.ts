import { describe, expect, it } from 'vitest'
import { toTodoId } from './todo_state.pure.lib.ts'

describe('toTodoId', () => {
  it('keeps the raw string value', () => {
    expect(toTodoId('abc')).toBe('abc')
  })
})
