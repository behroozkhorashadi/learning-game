import { describe, expect, it } from 'vitest'
import { bindSpeech } from './speech.effect.lib.ts'

/** A synthesis that records what it was asked to say. */
function fakeVoice() {
  const said: { text: string; rate: number; pitch: number }[] = []
  let cancels = 0
  const synthesis = {
    cancel: (): void => {
      cancels += 1
    },
    speak: (u: SpeechSynthesisUtterance): void => {
      said.push({ text: u.text, rate: u.rate, pitch: u.pitch })
    },
  }
  // jsdom has no SpeechSynthesisUtterance; the fields bindSpeech sets are all it reads. Cast confined to this test helper.
  const makeUtterance = (text: string) => ({ text, rate: 1, pitch: 1 }) as SpeechSynthesisUtterance
  return { synthesis, makeUtterance, said, cancels: () => cancels }
}

const flush = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve))

describe('bindSpeech', () => {
  it('speaks text in the slower, higher kid voice, cancelling anything already speaking', () => {
    const voice = fakeVoice()
    bindSpeech({ ...voice, playClip: () => Promise.resolve() }).speakText('Tap Start')
    expect(voice.said).toEqual([{ text: 'Tap Start', rate: 0.85, pitch: 1.1 }])
    expect(voice.cancels()).toBe(1)
  })

  it("plays the word's clip and doesn't use the voice when the clip plays", async () => {
    const voice = fakeVoice()
    const clips: string[] = []
    bindSpeech({
      ...voice,
      playClip: (url) => {
        clips.push(url)
        return Promise.resolve()
      },
    }).speakWord('Rabbit')
    await flush()
    expect(clips).toEqual(['/audio/words/rabbit.mp3'])
    expect(voice.said).toEqual([])
  })

  it('falls back to the voice when there is no clip', async () => {
    const voice = fakeVoice()
    bindSpeech({ ...voice, playClip: () => Promise.reject(new Error('404')) }).speakWord('Zyx')
    await flush()
    await flush()
    expect(voice.said.map((s) => s.text)).toEqual(['Zyx'])
  })

  it('does nothing for a word with no letters, or without a voice', async () => {
    const clips: string[] = []
    const speech = bindSpeech({
      synthesis: null,
      makeUtterance: fakeVoice().makeUtterance,
      playClip: (url) => {
        clips.push(url)
        return Promise.reject(new Error('404'))
      },
    })
    speech.speakWord('123')
    speech.speakText('hello')
    speech.speakWord('cat')
    await flush()
    expect(clips).toEqual(['/audio/words/cat.mp3'])
  })
})
