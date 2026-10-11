import { describe, expect, it } from 'vitest'
import { GAMES } from './home_fixtures.test.lib.ts'
import { VISIBLE_GAME_IDS, visibleGames } from './home_games.pure.lib.ts'

describe('visibleGames', () => {
  it('keeps only the trimmed roster, in catalog order', () => {
    expect(visibleGames(GAMES).map((g) => g.id)).toEqual(['fact_fluency', 'pathfinder_no_way_back'])
  })

  it('shows Zombie Horde alongside Equation Outbreak', () => {
    expect(VISIBLE_GAME_IDS.has('zombie_horde')).toBe(true)
  })
})
