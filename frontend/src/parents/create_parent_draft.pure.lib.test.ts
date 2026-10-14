import { describe, expect, it } from 'vitest'
import { createParentProblem, parentCreateFrom } from './create_parent_draft.pure.lib.ts'

describe('the new-parent draft', () => {
  it('needs a name and a matching password of four or more', () => {
    expect(createParentProblem({ name: ' ', password: 'abcd', confirm: 'abcd' })).toBe('Add your name.')
    expect(createParentProblem({ name: 'Mom', password: 'abc', confirm: 'abc' })).toBe('Pick a password of at least 4 characters.')
    expect(createParentProblem({ name: 'Mom', password: 'abcd', confirm: 'abce' })).toBe('The two passwords don’t match.')
    expect(createParentProblem({ name: 'x'.repeat(41), password: 'abcd', confirm: 'abcd' })).toBe('Keep the name under 40 characters.')
  })

  it('sends the trimmed name with the password', () => {
    expect(parentCreateFrom({ name: ' Mom ', password: 'abcd', confirm: 'abcd' })).toEqual({ name: 'Mom', password: 'abcd' })
    expect(parentCreateFrom({ name: 'Mom', password: 'abcd', confirm: '' })).toBeNull()
  })
})
