import type { ComponentType } from 'react'
import { assembleIllustrationReveal, assembleWritingGameDeps } from '@app/writing/writing.assembly.main.ts'
import { bindStyleRemix, type StyleRemixProps } from './style_remix.effect.ui.tsx'

/** Wires Style Remix Lab to the real pieces API, timers, and illustration reveal. Called once by the app shell. */
export function assembleStyleRemix(): ComponentType<StyleRemixProps> {
  return bindStyleRemix({ ...assembleWritingGameDeps(), IllustrationReveal: assembleIllustrationReveal() })
}
