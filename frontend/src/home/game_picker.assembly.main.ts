import type { ComponentType } from 'react'
import { bindPiecesApi } from '@app/api/pieces_api.effect.lib.ts'
import { bindGamePicker } from './game_picker.effect.ui.tsx'
import type { GamePickerProps } from './game_picker.pure.ui.tsx'

/** Wires the kid home to the real game catalog. Called once by the app shell. */
export function assembleGamePicker(): ComponentType<GamePickerProps> {
  return bindGamePicker({
    listGames: bindPiecesApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' }).games,
    currentYear: new Date().getFullYear(),
  })
}
