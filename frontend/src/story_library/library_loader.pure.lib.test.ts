import { describe, expect, it } from 'vitest'
import { CROW, LIGHTHOUSE, fakePiecesStore, illustration, piece } from './library_fixtures.test.lib.ts'
import { loadLibrary, loadShelfPeek } from './library_loader.pure.lib.ts'

describe('loadLibrary', () => {
  it('loads pieces newest first, their illustrations, and game titles', async () => {
    const pic = illustration('p1')
    const data = await loadLibrary(fakePiecesStore([LIGHTHOUSE, CROW], { p1: [pic] }), 1)
    expect(data.pieces.map((p) => p.id)).toEqual(['p2', 'p1'])
    expect(data.illustrations).toEqual({ p1: [pic], p2: [] })
    expect(data.gameTitles).toEqual({ syllable_builder: 'Syllable Builder' })
  })

  it('a failed illustration load leaves that piece without pictures', async () => {
    const data = await loadLibrary(fakePiecesStore([LIGHTHOUSE], {}, { illustrations: 'HTTP 500' }), 1)
    expect(data.illustrations).toEqual({ p1: [] })
  })

  it('fails when the piece list does', async () => {
    await expect(loadLibrary(fakePiecesStore([], {}, { list: 'GET /api/pieces failed with HTTP 500' }), 1)).rejects.toThrow('HTTP 500')
  })
})

describe('loadShelfPeek', () => {
  it('loads covers only for the newest three', async () => {
    const asked: string[] = []
    const store = fakePiecesStore(['a', 'b', 'c', 'd'].map((id, i) => piece(id, { created_at: `2026-0${String(i + 1)}-01T00:00:00Z` })))
    const peek = await loadShelfPeek({ list: store.list, illustrations: (id) => (asked.push(id), store.illustrations(id)) }, 1)
    expect(peek.pieces.map((p) => p.id)).toEqual(['d', 'c', 'b', 'a'])
    expect(asked).toEqual(['d', 'c', 'b'])
  })

  it('reads a failed load as an empty library', async () => {
    expect(await loadShelfPeek(fakePiecesStore([], {}, { list: 'HTTP 500' }), 1)).toEqual({ pieces: [], illustrations: {} })
  })
})
