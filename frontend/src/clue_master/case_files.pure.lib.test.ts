import { describe, expect, it } from 'vitest'
import { CASE_FILES, coachQuestions, dealCase } from './case_files.pure.lib.ts'

describe('case files', () => {
  it('deals by the random source and never repeats the case just dealt', () => {
    expect(dealCase(() => 0)).toBe(CASE_FILES[0])
    expect(dealCase(() => 0, 'umbrella').key).toBe('key')
  })

  it('asks three coach questions, answered once anything changed', () => {
    expect(coachQuestions(true).map((q) => q.answered)).toEqual([true, true, true])
  })
})
