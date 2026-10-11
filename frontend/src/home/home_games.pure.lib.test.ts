import { describe, expect, it } from 'vitest'
import { GAMES } from './home_fixtures.test.lib.ts'
import { visibleGames } from './home_games.pure.lib.ts'

describe('visibleGames', () => {
  it('keeps only the trimmed roster, in catalog order', () => {
    expect(visibleGames(GAMES).map((g) => g.id)).toEqual(['fact_fluency', 'pathfinder_no_way_back'])
  })
})
