import type { ComponentType } from 'react'
import { assemblePracticeDeps } from '@app/practice/practice.assembly.main.ts'
import { assembleSpeech } from '@app/speech/speech.assembly.main.ts'
import { bindSyllableBuilder, type SyllableBuilderProps } from './syllable_builder.effect.ui.tsx'
import { SYLLABLE_GAME_ID, parseSyllablePayload } from './syllable_item.pure.lib.ts'

/** Wires Syllable Builder to the real practice API, speech, and clock. Called once by the app shell. */
export function assembleSyllableBuilder(): ComponentType<SyllableBuilderProps> {
  return bindSyllableBuilder({ practice: assemblePracticeDeps(SYLLABLE_GAME_ID, parseSyllablePayload), speech: assembleSpeech() })
}
