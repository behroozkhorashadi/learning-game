import { describe, expect, it } from 'vitest'
import type { HttpFetch } from './http.pure.lib.ts'
import { bindPiecesApi } from './pieces_api.effect.lib.ts'

const PIECE = { id: 'p1', profile_id: 1, game_id: 'prompt_forge', body: 'Once.', word_count: 1 }
const ILLUSTRATION = { piece_id: 'p1', image_url: '/static/i.png', prompt_excerpt: 'Once.', order: 0, is_hero: true }

function server(): { readonly fetch: HttpFetch; readonly calls: string[] } {
  const calls: string[] = []
  const fetch: HttpFetch = (url, init) => {
    calls.push(`${init.method} ${url}`)
    const body = url.startsWith('/api/games') ? [] : url.endsWith('/illustrations') ? [ILLUSTRATION] : url.endsWith('/generate') ? ILLUSTRATION : url.includes('?profile_id') ? [PIECE] : PIECE
    return Promise.resolve({ ok: true, status: init.method === 'DELETE' ? 204 : 200, json: () => Promise.resolve(body) })
  }
  return { fetch, calls }
}

describe('bindPiecesApi', () => {
  it('reaches every pieces endpoint and parses with defaults', async () => {
    const { fetch, calls } = server()
    const api = bindPiecesApi({ fetch, baseUrl: '' })
    expect(await api.create({ profile_id: 1, game_id: 'prompt_forge', body: 'Once.' })).toMatchObject({ id: 'p1', title: null, constraints: [] })
    expect(await api.list(1)).toHaveLength(1)
    await api.addRevision('p1', { changed: true })
    await api.addRemix('p1', { body: 'x', style_key: 'k', is_favourite: false })
    await api.addTurn('p1', { author: 'kid', order: 0, text: 'Hi' })
    expect((await api.illustrations('p1'))[0]?.id).toBeNull()
    expect((await api.generateIllustration('p1', { prompt_excerpt: 'Once.', order: 0, is_hero: true })).image_url).toBe('/static/i.png')
    await api.remove('p1')
    expect(await api.games()).toEqual([])
    expect(calls).toEqual([
      'POST /api/pieces',
      'GET /api/pieces?profile_id=1',
      'POST /api/pieces/p1/revisions',
      'POST /api/pieces/p1/remixes',
      'POST /api/pieces/p1/turns',
      'GET /api/pieces/p1/illustrations',
      'POST /api/pieces/p1/illustrations/generate',
      'DELETE /api/pieces/p1',
      'GET /api/games',
    ])
  })

  it('rejects a failed call', async () => {
    const fetch: HttpFetch = () => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve(null) })
    await expect(bindPiecesApi({ fetch, baseUrl: '' }).create({ profile_id: 1, game_id: 'g', body: '' })).rejects.toThrow('POST /api/pieces failed with HTTP 503')
  })
})
