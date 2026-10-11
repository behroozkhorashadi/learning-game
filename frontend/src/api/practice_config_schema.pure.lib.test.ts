import { describe, expect, it } from 'vitest'
import { practiceConfigSchema } from './practice_config_schema.pure.lib.ts'

describe('practiceConfigSchema', () => {
  it('rejects focus numbers that are not number lists', () => {
    expect(practiceConfigSchema.safeParse({ profile_id: 1, game_id: 'g', operations: [], focus_numbers: { '+': ['7'] }, difficulty: 1 }).success).toBe(false)
  })
})
