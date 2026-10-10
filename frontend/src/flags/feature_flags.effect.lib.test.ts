import { describe, expect, it } from 'vitest'
import { bindFeatureFlags } from './feature_flags.effect.lib.ts'

describe('bindFeatureFlags', () => {
  it('enables flags listed in ?flags=', () => {
    expect(bindFeatureFlags({ search: '?flags=examples_todo_backup' }).isEnabled('examples_todo_backup')).toBe(true)
  })

  it('is off by default', () => {
    expect(bindFeatureFlags({ search: '' }).isEnabled('examples_todo_backup')).toBe(false)
  })

  it('ignores unknown names and whitespace', () => {
    expect(bindFeatureFlags({ search: '?flags=nope, examples_todo_backup ' }).isEnabled('examples_todo_backup')).toBe(true)
  })
})
