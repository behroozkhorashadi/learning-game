import type { ComponentType, ReactElement } from 'react'
import type { GameRecord } from '@app/api/pieces_schema.pure.lib.ts'
import { useQuery } from '@app/query/use_query.pure.hook.ts'
import { GamePickerView, type GamePickerProps } from './game_picker.pure.ui.tsx'

export interface GamePickerDeps {
  /** GET /api/games. In the app, the pieces adapter's `games`. */
  readonly listGames: () => Promise<readonly GameRecord[]>
  readonly currentYear: number
}

/** The kid home: loads the game catalog and renders the view. */
export function bindGamePicker({ listGames, currentYear }: GamePickerDeps): ComponentType<GamePickerProps> {
  function GamePicker(props: GamePickerProps): ReactElement {
    const games = useQuery(listGames)
    return <GamePickerView games={games} age={currentYear - props.profile.birth_year} {...props} />
  }
  return GamePicker
}
