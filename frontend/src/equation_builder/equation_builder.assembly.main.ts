import type { ComponentType } from 'react'
import { assemblePracticeDeps } from '@app/practice/practice.assembly.main.ts'
import { assembleSpeech } from '@app/speech/speech.assembly.main.ts'
import { bindEquationBuilder, type EquationBuilderProps } from './equation_builder.effect.ui.tsx'
import { EQUATION_GAME_ID, parseEquationPayload } from './equation_item.pure.lib.ts'

/** Wires Equation Builder to the real practice API, speech, and clock. Called once by the app shell. */
export function assembleEquationBuilder(): ComponentType<EquationBuilderProps> {
  return bindEquationBuilder({ practice: assemblePracticeDeps(EQUATION_GAME_ID, parseEquationPayload), speech: assembleSpeech() })
}
