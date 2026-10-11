import { describe, expect, it } from 'vitest'
import { SCIENTIST_ZOMBIE } from '@app/zombies/character_definitions.pure.lib.ts'
import { addShot, distinctConfigs, exportDocument, labConfigFromSearch, labelPending, parseShots, percentOf, scoreShots, type LabShot } from './hit_lab_state.pure.lib.ts'

function shot(id: string, expected: LabShot['expected'], recorded: LabShot['recorded'], overrides: Partial<LabShot> = {}): LabShot {
  return { id, characterId: 'scientist', lane: 1, distance: 0.5, poseTime: 0.5, ndc: { x: 0, y: 0 }, expected, recorded, ...overrides }
}

describe('hit lab shots', () => {
  it('reads saved shots and fixture documents, and nothing from junk', () => {
    const shots = [shot('a', 'head', 'head')]
    expect(parseShots(JSON.stringify(shots))).toEqual(shots)
    expect(parseShots(JSON.stringify({ version: 1, shots }))).toEqual(shots)
    expect(parseShots('not json')).toEqual([])
    expect(parseShots(JSON.stringify([{ id: 'x' }]))).toEqual([])
    expect(parseShots(null)).toEqual([])
  })

  it('a new shot drops an unlabeled one, and labeling fills the one waiting', () => {
    const shots = addShot(addShot([], shot('a', null, 'miss')), shot('b', null, 'head'))
    expect(shots.map((s) => s.id)).toEqual(['b'])
    expect(labelPending(shots, 'body')[0]?.expected).toBe('body')
    expect(labelPending([shot('c', 'head', 'head')], 'body')[0]?.expected).toBe('head')
  })

  it('exports only labeled shots', () => {
    const doc: unknown = JSON.parse(exportDocument([shot('a', 'head', 'head'), shot('b', null, 'miss')], 16 / 9))
    expect(doc).toMatchObject({ version: 1, shots: [{ id: 'a' }] })
  })

  it('scores agreement, false misses, false hits, and zone swaps against the latest outcome', () => {
    const score = scoreShots([
      shot('1', 'head', 'head'),
      shot('2', 'head', 'miss'),
      shot('3', 'miss', 'body'),
      shot('4', 'head', 'body'),
      shot('5', 'body', 'miss', { rescored: 'body' }),
      shot('6', null, 'head'),
    ])
    expect(score).toEqual({ labeled: 5, hitMissAgree: 3, falseMisses: 1, falseHits: 1, zoneWrong: 1 })
    expect(percentOf(3, 5)).toBe('60%')
    expect(percentOf(0, 0)).toBe('—')
  })

  it('lists each setup once', () => {
    expect(distinctConfigs([shot('a', 'head', 'head'), shot('b', 'head', 'head'), shot('c', 'head', 'head', { lane: 2 })])).toHaveLength(2)
  })
})

describe('labConfigFromSearch', () => {
  it('reads the setup from the URL, falling back per field', () => {
    expect(labConfigFromSearch('?character=hockey&lane=2&distance=0.25&pose=1.5', SCIENTIST_ZOMBIE)).toEqual({ characterId: 'hockey', lane: 2, distance: 0.25, poseTime: 1.5 })
    expect(labConfigFromSearch('?lane=oops', SCIENTIST_ZOMBIE)).toEqual({ characterId: SCIENTIST_ZOMBIE.id, lane: 1, distance: 0.5, poseTime: 0.5 })
  })
})
