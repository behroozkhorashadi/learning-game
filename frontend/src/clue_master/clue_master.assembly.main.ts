import type { ComponentType } from 'react'
import { assembleIllustrationReveal, assembleWritingGameDeps } from '@app/writing/writing.assembly.main.ts'
import { bindClueMaster, type ClueMasterProps } from './clue_master.effect.ui.tsx'

/** Wires Clue Master to the real pieces API, timers, and illustration reveal. Called once by the app shell. */
export function assembleClueMaster(): ComponentType<ClueMasterProps> {
  return bindClueMaster({ ...assembleWritingGameDeps(), IllustrationReveal: assembleIllustrationReveal() })
}
