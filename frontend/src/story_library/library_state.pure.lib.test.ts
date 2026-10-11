import { describe, expect, it } from 'vitest'
import { CROW, LIGHTHOUSE, illustration, piece } from './library_fixtures.test.lib.ts'
import { buildBlocks, byOrder, chunk, formatDate, heroOf, newestFirst, styleOf } from './library_state.pure.lib.ts'

describe('library state', () => {
  it('sorts newest first, treating a missing date as oldest', () => {
    expect(newestFirst([LIGHTHOUSE, CROW, piece('p3', { created_at: '' })]).map((p) => p.id)).toEqual(['p2', 'p1', 'p3'])
  })

  it('falls back to the storybook style for an unknown art style', () => {
    expect([styleOf(piece('a', { art_style: 'chalk' })), styleOf(piece('b', { art_style: 'crayon' })), styleOf(piece('c', { art_style: null }))]).toEqual(['chalk', 'storybook', 'storybook'])
  })

  it('picks the hero illustration, or the first', () => {
    const a = illustration('p1', { is_hero: false, order: 1 })
    const b = illustration('p1', { is_hero: true, order: 0 })
    expect(heroOf([a, b])).toBe(b)
    expect(heroOf([a])).toBe(a)
    expect(heroOf([])).toBeUndefined()
    expect(byOrder([a, b])).toEqual([b, a])
  })

  it('places each picture after the paragraph it came from, and the rest at the end', () => {
    const fits = illustration('p2', { prompt_excerpt: 'found a map' })
    const loose = illustration('p2', { prompt_excerpt: 'not in the text' })
    expect(buildBlocks(CROW.body, [loose, fits])).toEqual([
      { kind: 'text', text: 'A crow found a map.' },
      { kind: 'image', illustration: fits },
      { kind: 'text', text: 'It flew home.' },
      { kind: 'image', illustration: loose },
    ])
    expect(buildBlocks('', [])).toEqual([])
  })

  it('chunks the shelf into rows and formats dates', () => {
    expect(chunk([1, 2, 3, 4], 3)).toEqual([[1, 2, 3], [4]])
    expect(formatDate(null)).toBe('')
    expect(formatDate('2026-01-15T12:00:00Z')).not.toBe('')
  })
})
