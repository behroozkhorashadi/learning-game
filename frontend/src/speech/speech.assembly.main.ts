import { bindSpeech } from './speech.effect.lib.ts'
import type { Speech } from './speech_state.pure.lib.ts'

/** Speech over the browser's speechSynthesis and an `<audio>` element per clip. */
export function assembleSpeech(): Speech {
  return bindSpeech({
    synthesis: 'speechSynthesis' in window ? window.speechSynthesis : null,
    makeUtterance: (text) => new SpeechSynthesisUtterance(text),
    playClip: (url) =>
      new Promise((resolve, reject) => {
        const audio = new Audio(url)
        // A missing clip fires `error` (404) rather than rejecting play().
        audio.addEventListener('error', () => {
          reject(new Error(`no clip at ${url}`))
        })
        audio.play().then(resolve, reject)
      }),
  })
}
