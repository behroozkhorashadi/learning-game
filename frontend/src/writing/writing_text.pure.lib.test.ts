import { describe, expect, it } from 'vitest'
import { capitalize, sentencesOf, wordCountOf } from './writing_text.pure.lib.ts'

describe('writing text', () => {
  it('counts words and splits sentences', () => {
    expect([wordCountOf(''), wordCountOf('  one  two\nthree ')]).toEqual([0, 3])
    expect(sentencesOf('Hi there. Who are you? Me!  ')).toEqual(['Hi there.', 'Who are you?', 'Me!'])
    expect(capitalize('a crow')).toBe('A crow')
  })
})
