import { describe, expect, it } from 'vitest'
import { assembleSpeech } from './speech.assembly.main.ts'

describe('assembleSpeech', () => {
  it('assembles in a browser without speechSynthesis (jsdom) and speaking is a no-op', () => {
    const speech = assembleSpeech()
    expect(() => {
      speech.speakText('hello')
    }).not.toThrow()
  })
})
