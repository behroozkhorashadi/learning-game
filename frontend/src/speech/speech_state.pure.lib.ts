/** Speaking words and instructions aloud. In the app, speech.assembly.main.ts. */
export interface Speech {
  /** Speaks arbitrary text (instructions) with the browser's voice. */
  readonly speakText: (text: string) => void
  /** Plays the word's pre-generated natural-voice clip (`make gen-audio`), falling back to the browser's voice if there's none. */
  readonly speakWord: (word: string) => void
}

/** The clip file name for a word ('Rab-bit!' → 'rabbit'), or null if nothing is left to say. */
export function wordClipSlug(word: string): string | null {
  const slug = word.trim().toLowerCase().replace(/[^a-z]/g, '')
  return slug === '' ? null : slug
}
