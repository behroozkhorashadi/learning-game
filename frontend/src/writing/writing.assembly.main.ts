import type { ComponentType } from 'react'
import { bindPiecesApi } from '@app/api/pieces_api.effect.lib.ts'
import { assembleRandomId } from '@app/ids/random_id.assembly.main.ts'
import { assembleTimers } from '@app/timing/timing.assembly.main.ts'
import { bindIllustrationReveal, type IllustrationRevealProps } from './illustration_reveal.effect.ui.tsx'
import { bindModifierDeck, type ModifierDeckProps } from './modifier_deck.effect.ui.tsx'
import type { WritingGameDeps } from './writing_game_state.pure.lib.ts'

/** The illustration reveal over the real pieces API and timers. */
export function assembleIllustrationReveal(): ComponentType<IllustrationRevealProps> {
  const api = bindPiecesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return bindIllustrationReveal({ generateIllustration: api.generateIllustration, timers: assembleTimers() })
}

/** The modifier deck over real timers and `Math.random`. */
export function assembleModifierDeck(): ComponentType<ModifierDeckProps> {
  return bindModifierDeck({ timers: assembleTimers(), random: Math.random })
}

/** What every writing game gets in the app: the pieces API, real timers, `Math.random`, random session ids. */
export function assembleWritingGameDeps(): WritingGameDeps {
  const api = bindPiecesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
  return {
    pieces: { create: api.create, addRevision: api.addRevision, addRemix: api.addRemix, addTurn: api.addTurn },
    timers: assembleTimers(),
    random: Math.random,
    createId: assembleRandomId(),
  }
}
