import { wordClipSlug, type Speech } from './speech_state.pure.lib.ts'

/**
 * Word pronunciation: prefers a pre-generated natural-voice clip over the
 * browser's speechSynthesis (which tends to sound robotic), and falls back
 * to speechSynthesis for any word that doesn't have a clip yet.
 */

export interface SpeechDeps {
  /** `window.speechSynthesis`, or null where the browser has none. */
  readonly synthesis: Pick<SpeechSynthesis, 'cancel' | 'speak'> | null
  /** `(text) => new SpeechSynthesisUtterance(text)`. */
  readonly makeUtterance: (text: string) => SpeechSynthesisUtterance
  /** Plays an audio file; rejects if it can't load or play (`new Audio(url)`). */
  readonly playClip: (url: string) => Promise<void>
}

export function bindSpeech({ synthesis, makeUtterance, playClip }: SpeechDeps): Speech {
  // The current utterance's end callback, so stopping or replacing it ends it exactly once.
  let endCurrent: (() => void) | null = null

  function finishCurrent(): void {
    const end = endCurrent
    endCurrent = null
    end?.()
  }

  function stopSpeaking(): void {
    finishCurrent()
    try {
      synthesis?.cancel()
    } catch {
      // Speech is a nice-to-have; ignore a browser that refuses.
    }
  }

  function speakWithVoice(text: string, onEnd?: () => void): void {
    stopSpeaking()
    if (synthesis === null) {
      onEnd?.()
      return
    }
    const mine = (): void => {
      onEnd?.()
    }
    endCurrent = mine
    // A late event from an utterance that was already stopped or replaced ends nothing.
    const ended = (): void => {
      if (endCurrent === mine) finishCurrent()
    }
    try {
      const utterance = makeUtterance(text)
      utterance.rate = 0.85
      utterance.pitch = 1.1
      utterance.onend = ended
      utterance.onerror = ended
      synthesis.speak(utterance)
    } catch {
      // Speech is a nice-to-have; a browser that refuses just ends it.
      ended()
    }
  }

  return {
    speakText: speakWithVoice,
    stopSpeaking,
    speakWord: (word) => {
      const slug = wordClipSlug(word)
      if (slug === null) return
      playClip(`/audio/words/${slug}.mp3`).catch(() => {
        speakWithVoice(word)
      })
    },
  }
}
