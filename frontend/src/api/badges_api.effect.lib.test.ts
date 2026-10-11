import { describe, expect, it } from 'vitest'
import { bindBadgesApi } from './badges_api.effect.lib.ts'
import type { HttpFetch } from './http.pure.lib.ts'

function serving(bodies: Readonly<Record<string, unknown>>, status = 200): HttpFetch & { readonly urls: string[] } {
  const urls: string[] = []
  const fetch: HttpFetch = (url) => {
    urls.push(url)
    return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(bodies[url]) })
  }
  return Object.assign(fetch, { urls })
}

describe('bindBadgesApi', () => {
  it('reads badges and stats, filling the optional fields', async () => {
    const fetch = serving({
      '/api/profiles/1/badges': [{ key: 'k', name: 'N', description: 'D', art_url: '/a.png', earned: false }],
      '/api/profiles/1/stats': { total_stars: 3, day_streak: 1, minutes_this_week: 5 },
    })
    const api = bindBadgesApi({ fetch, baseUrl: '' })
    expect(await api.badges(1)).toEqual([{ key: 'k', name: 'N', description: 'D', art_url: '/a.png', earned: false, awarded_at: null }])
    expect(await api.stats(1)).toEqual({ total_stars: 3, day_streak: 1, minutes_this_week: 5, most_played_game: null, avg_rating: null, last_session_at: null, progress_delta_pct: null })
  })

  it('rejects a failed or malformed response', async () => {
    await expect(bindBadgesApi({ fetch: serving({}, 500), baseUrl: '' }).badges(1)).rejects.toThrow('GET /api/profiles/1/badges failed with HTTP 500')
    await expect(bindBadgesApi({ fetch: serving({ '/api/profiles/1/stats': { total_stars: 'x' } }), baseUrl: '' }).stats(1)).rejects.toThrow('unexpected body')
  })
})
