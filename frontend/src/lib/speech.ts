/**
 * Shared word-pronunciation helper. Prefers a pre-generated natural-voice
 * clip (see `make gen-audio`) over the browser's native speechSynthesis,
 * which tends to sound robotic; falls back to speechSynthesis for any word
 * that doesn't have a clip yet.
 */

function fallbackSpeak(text: string) {
  try {
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 0.85
      u.pitch = 1.1
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    }
  } catch {
    // speech synthesis is a nice-to-have; ignore if unavailable
  }
}

export function speakWord(word: string) {
  const slug = word.trim().toLowerCase().replace(/[^a-z]/g, '')
  if (!slug) return

  let usedFallback = false
  const fallback = () => {
    if (usedFallback) return
    usedFallback = true
    fallbackSpeak(word)
  }

  const audio = new Audio(`/audio/words/${slug}.mp3`)
  audio.addEventListener('error', fallback)
  audio.play().catch(fallback)
}
