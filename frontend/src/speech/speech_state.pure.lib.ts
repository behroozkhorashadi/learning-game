/** Speaking words and instructions aloud. In the app, speech.assembly.main.ts. */
export interface Speech {
  /**
   * Speaks arbitrary text (instructions) with the browser's voice. `onEnd` runs
   * exactly once: when it finishes, is stopped, or is cut off by other speech.
   */
  readonly speakText: (text: string, onEnd?: () => void) => void
  /** Stops whatever the browser's voice is saying (clips are short and play out). */
  readonly stopSpeaking: () => void
  /** Plays the word's pre-generated natural-voice clip (`make gen-audio`), falling back to the browser's voice if there's none. */
  readonly speakWord: (word: string) => void
}

/** What a "hear how to play" button needs: start reading, and stop. */
export type ReadAloud = Pick<Speech, 'speakText' | 'stopSpeaking'>

/** The clip file name for a word ('Rab-bit!' → 'rabbit'), or null if nothing is left to say. */
export function wordClipSlug(word: string): string | null {
  const slug = word.trim().toLowerCase().replace(/[^a-z]/g, '')
  return slug === '' ? null : slug
}
