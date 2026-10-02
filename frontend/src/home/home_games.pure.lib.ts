import type { GameRecord } from '@app/api/pieces_schema.pure.lib.ts'

/**
 * Temporary roster trim: only these games are shown while development is
 * focused on Equation Outbreak and Pathfinder. The others stay registered and
 * playable (via ?screen= dev links, or a direct gameId); this only filters
 * the kid home. Delete it to bring the full roster back.
 */
export const VISIBLE_GAME_IDS: ReadonlySet<string> = new Set(['fact_fluency', 'zombie_horde', 'pathfinder_no_way_back', 'syllable_builder'])

const GAME_AGE_RANGES: Readonly<Record<string, readonly [minAge: number, maxAge: number]>> = {
  syllable_builder: [6, 8],
}

/** Games with a parent-facing practice-settings screen (GameModule.supports_practice_config() on the backend). */
export const GAMES_WITH_PRACTICE_SETTINGS: ReadonlySet<string> = new Set(['fact_fluency'])

export function visibleGames(games: readonly GameRecord[], age: number): readonly GameRecord[] {
  return games.filter((game) => {
    if (!VISIBLE_GAME_IDS.has(game.id)) return false
    const range = GAME_AGE_RANGES[game.id]
    return range === undefined || (age >= range[0] && age <= range[1])
  })
}
