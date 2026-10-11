import { describe, expect, it } from 'vitest'
import { wordClipSlug } from './speech_state.pure.lib.ts'

describe('wordClipSlug', () => {
  it('keeps only lowercase letters', () => {
    expect(wordClipSlug(' Rab-bit! ')).toBe('rabbit')
    expect(wordClipSlug('42 ?')).toBeNull()
  })
})
