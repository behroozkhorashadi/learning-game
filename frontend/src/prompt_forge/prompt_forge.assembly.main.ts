import type { ComponentType } from 'react'
import { assembleIllustrationReveal, assembleWritingGameDeps } from '@app/writing/writing.assembly.main.ts'
import { bindPromptForge, type PromptForgeProps } from './prompt_forge.effect.ui.tsx'

/** Wires Prompt Forge to the real pieces API, timers, and illustration reveal. Called once by the app shell. */
export function assemblePromptForge(): ComponentType<PromptForgeProps> {
  return bindPromptForge({ ...assembleWritingGameDeps(), IllustrationReveal: assembleIllustrationReveal() })
}
