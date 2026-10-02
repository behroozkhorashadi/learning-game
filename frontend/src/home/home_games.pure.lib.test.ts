import { describe, expect, it } from 'vitest'
import { GAMES } from './home_fixtures.test.lib.ts'
import { VISIBLE_GAME_IDS, visibleGames } from './home_games.pure.lib.ts'

describe('visibleGames', () => {
  it('keeps only the trimmed roster, in catalog order', () => {
    expect(visibleGames(GAMES, 9).map((g) => g.id)).toEqual(['fact_fluency', 'pathfinder_no_way_back'])
  })

  it('shows Syllable Builder only for ages 6 through 8', () => {
    expect(visibleGames(GAMES, 5).map((g) => g.id)).not.toContain('syllable_builder')
    expect(visibleGames(GAMES, 6).map((g) => g.id)).toContain('syllable_builder')
    expect(visibleGames(GAMES, 8).map((g) => g.id)).toContain('syllable_builder')
    expect(visibleGames(GAMES, 9).map((g) => g.id)).not.toContain('syllable_builder')
  })

  it('shows Zombie Horde alongside Equation Outbreak', () => {
    expect(VISIBLE_GAME_IDS.has('zombie_horde')).toBe(true)
  })
})
