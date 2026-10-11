import type { ComponentType } from 'react'
import { bindPiecesApi } from '@app/api/pieces_api.effect.lib.ts'
import { assembleTimers } from '@app/timing/timing.assembly.main.ts'
import { bindIllustrationReveal, type IllustrationRevealProps } from './illustration_reveal.effect.ui.tsx'
import { bindModifierDeck, type ModifierDeckProps } from './modifier_deck.effect.ui.tsx'

/** The illustration reveal over the real pieces API and timers. */
export function assembleIllustrationReveal(): ComponentType<IllustrationRevealProps> {
  const api = bindPiecesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindIllustrationReveal({ generateIllustration: api.generateIllustration, timers: assembleTimers() })
}

/** The modifier deck over real timers and `Math.random`. */
export function assembleModifierDeck(): ComponentType<ModifierDeckProps> {
  return bindModifierDeck({ timers: assembleTimers(), random: Math.random })
}
