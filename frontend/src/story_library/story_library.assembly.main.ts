import type { ComponentType } from 'react'
import { bindPiecesApi, type PiecesApi } from '@app/api/pieces_api.effect.lib.ts'
import { bindStorybookEntryCard, type StorybookEntryCardProps } from './entry_card.effect.ui.tsx'
import { loadLibrary, loadShelfPeek } from './library_loader.pure.lib.ts'
import { bindStoryLibrary, type StoryLibraryProps } from './story_library.effect.ui.tsx'

function piecesApi(): PiecesApi {
  return bindPiecesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' })
}

/** The library screen over the real pieces API and `window.confirm`. Called once by the app shell. */
export function assembleStoryLibrary(): ComponentType<StoryLibraryProps> {
  const api = piecesApi()
  return bindStoryLibrary({
    loadLibrary: (profileId) => loadLibrary(api, profileId),
    removePiece: api.remove,
    confirm: (message) => window.confirm(message),
  })
}

/** The home entry card over the real pieces API. */
export function assembleStorybookEntryCard(): ComponentType<StorybookEntryCardProps> {
  const api = piecesApi()
  return bindStorybookEntryCard({ loadPeek: (profileId) => loadShelfPeek(api, profileId) })
}
