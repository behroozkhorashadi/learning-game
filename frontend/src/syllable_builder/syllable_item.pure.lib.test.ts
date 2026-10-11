import { describe, expect, it } from 'vitest'
import { SYLLABLE_CONFIG, parseSyllablePayload, syllableBoard } from './syllable_item.pure.lib.ts'

describe('syllable items', () => {
  it('parses the payload and builds a board with unique ids for repeated syllables', () => {
    const payload = parseSyllablePayload({ target_word: 'tomato', correct_syllables: ['to', 'ma', 'to'], tiles: ['ma', 'to', 'to'] })
    expect(syllableBoard(payload)).toMatchObject({ kind: 'word', spoken: 'tomato', slots: 3, answer: ['to', 'ma', 'to'], tiles: [{ id: 'ma-0' }, { id: 'to-1' }, { id: 'to-2' }] })
    expect(SYLLABLE_CONFIG.label(payload)).toBe('tomato')
  })

  it('rejects a malformed payload', () => {
    expect(() => parseSyllablePayload({ target_word: 'x' })).toThrow('unexpected payload')
  })
})
