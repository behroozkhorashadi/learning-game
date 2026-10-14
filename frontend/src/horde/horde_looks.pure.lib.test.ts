import { describe, expect, it } from 'vitest'
import type { ArmoryLooksRecord } from '@app/api/armory_schema.pure.lib.ts'
import { STEEL_SUIT, skinById } from './horde_armory.pure.lib.ts'
import { DEFAULT_LOOKS, EMBLEM_EMOJI, gearLookFor, isUnlocked, symbolEmblemUrl } from './horde_looks.pure.lib.ts'

const STARTER = ['starter_blaster', 'standard_rounds', 'steel_suit']
const looks = (overrides: Partial<ArmoryLooksRecord>): ArmoryLooksRecord => ({ ...DEFAULT_LOOKS, ...overrides })

describe('horde looks', () => {
  it('the default look is the steel suit, the blaster as it comes, no emblem, no billboard', () => {
    expect(gearLookFor({ looks: DEFAULT_LOOKS, pictures: {} }, STARTER)).toEqual({ skinId: 'steel_suit', armTint: null, armorColor: STEEL_SUIT.color, blasterTint: null, emblem: null, billboardUrl: null })
  })

  it('wears the saved skin, and falls back when it is not owned', () => {
    const gold = skinById('gold_suit')
    expect(gearLookFor({ looks: looks({ skin_id: 'gold_suit' }), pictures: {} }, [...STARTER, 'gold_suit'])).toMatchObject({ skinId: 'gold_suit', armTint: gold?.tint, armorColor: gold?.color })
    expect(gearLookFor({ looks: looks({ skin_id: 'gold_suit' }), pictures: {} }, STARTER).skinId).toBe('steel_suit')
  })

  it('suit paint replaces the skin tint, and glowing paint glows more than shiny, shiny more than matte', () => {
    const glows = (['matte', 'shiny', 'glow'] as const).map((shine) => {
      const look = gearLookFor({ looks: looks({ skin_id: 'gold_suit', suit_paint: { color: '#FF00AA', shine } }), pictures: {} }, [...STARTER, 'gold_suit'])
      expect(look.armTint?.color).toBe('#FF00AA')
      expect(look.armorColor).toBe('#FF00AA')
      return look.armTint?.glow ?? -1
    })
    expect(glows).toEqual([...glows].sort((a, b) => a - b))
    expect(new Set(glows).size).toBe(3)
  })

  it('paints the blaster', () => {
    expect(gearLookFor({ looks: looks({ blaster_color: '#00FF88' }), pictures: {} }, STARTER).blasterTint?.color).toBe('#00FF88')
  })

  it('a symbol emblem is a drawn badge; an art emblem is the art; where it goes follows the place', () => {
    const symbol = gearLookFor({ looks: looks({ emblem: { symbol: 'rocket', art_id: null, color: '#FFAA00', place: 'arm' } }), pictures: {} }, STARTER)
    expect(symbol.emblem).toEqual({ imageUrl: symbolEmblemUrl('rocket', '#FFAA00'), ringColor: '#FFAA00', onArm: true, onBlaster: false })
    const art = gearLookFor({ looks: looks({ emblem: { symbol: null, art_id: 'a1', color: '#123456', place: 'both' } }), pictures: { a1: '/a1.jpg' } }, STARTER)
    expect(art.emblem).toEqual({ imageUrl: '/a1.jpg', ringColor: '#123456', onArm: true, onBlaster: true })
    const blasterOnly = gearLookFor({ looks: looks({ emblem: { symbol: 'star', art_id: null, color: '#123456', place: 'blaster' } }), pictures: {} }, STARTER)
    expect([blasterOnly.emblem?.onArm, blasterOnly.emblem?.onBlaster]).toEqual([false, true])
  })

  it('art that is no longer in the gallery shows nothing rather than a broken picture', () => {
    const look = gearLookFor({ looks: looks({ emblem: { symbol: null, art_id: 'gone', color: '#123456', place: 'both' }, hung: { pathfinder: null, horde: 'gone' } }), pictures: {} }, STARTER)
    expect([look.emblem, look.billboardUrl]).toEqual([null, null])
  })

  it('hangs the billboard art', () => {
    expect(gearLookFor({ looks: looks({ hung: { pathfinder: null, horde: 'a1' } }), pictures: { a1: '/a1.jpg' } }, STARTER).billboardUrl).toBe('/a1.jpg')
  })

  it('a symbol badge is an SVG with the emoji on the colour', () => {
    const svg = decodeURIComponent(symbolEmblemUrl('dino', '#ABCDEF').replace('data:image/svg+xml;charset=utf-8,', ''))
    expect(svg).toContain('fill="#ABCDEF"')
    expect(svg).toContain(EMBLEM_EMOJI.dino)
  })

  it('knows which unlocks are owned', () => {
    expect(isUnlocked('suitPaint', [...STARTER, 'suit_paint'])).toBe(true)
    expect(isUnlocked('horde', STARTER)).toBe(false)
  })
})
