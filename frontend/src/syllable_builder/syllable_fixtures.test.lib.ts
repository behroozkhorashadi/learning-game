import type { SyllablePayload } from './syllable_item.pure.lib.ts'

export function syllableWord(word: string, syllables: readonly string[] = ['a', 'b']): SyllablePayload {
  return { target_word: word, correct_syllables: syllables, tiles: syllables }
}

/** "umbrella" repeats at round 4, as the backend's exhausted-pool fallback serves it. */
export const SESSION_WORDS: readonly SyllablePayload[] = ['elephant', 'computer', 'umbrella', 'umbrella', 'dinosaur'].map((w) => syllableWord(w))
