import { describe, expect, it } from 'vitest'
import { bindBadgesApi } from './badges_api.effect.lib.ts'
import type { HttpFetch } from './http.pure.lib.ts'

function serving(bodies: Readonly<Record<string, unknown>>, status = 200): HttpFetch & { readonly calls: string[] } {
  const calls: string[] = []
  const fetch: HttpFetch = (url, init) => {
    calls.push(`${init.method} ${url}`)
    return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(bodies[url]) })
  }
  return Object.assign(fetch, { calls })
}

const BADGE = { key: 'k', name: 'N', description: 'D', art_url: '/a.png', earned: false, category: 'streaks', tier: 'gold', art_status: 'none', celebrated: true }
const PARSED_BADGE = { ...BADGE, awarded_at: null, earned_reason: null, progress: null, goal: null, earned_in_game: null, personal_art_url: null }

describe('bindBadgesApi', () => {
  it('reads badges and stats, filling the optional fields', async () => {
    const day = { day: '2026-10-07', minutes: 12, rounds: 30, correct: 28, games: ['Zombie Horde'] }
    const fetch = serving({
      '/api/profiles/1/badges': [BADGE],
      '/api/profiles/1/stats': { total_stars: 3, day_streak: 1, minutes_this_week: 5, longest_streak: 4, total_minutes: 90, recent_days: [day] },
    })
    const api = bindBadgesApi({ fetch, baseUrl: '' })
    expect(await api.badges(1)).toEqual([PARSED_BADGE])
    expect(await api.stats(1)).toEqual({
      total_stars: 3,
      day_streak: 1,
      minutes_this_week: 5,
      most_played_game: null,
      avg_rating: null,
      last_session_at: null,
      progress_delta_pct: null,
      longest_streak: 4,
      total_minutes: 90,
      recent_days: [day],
    })
  })

  it('lists new badges, marks one celebrated, and paints one', async () => {
    const fetch = serving({ '/api/profiles/2/badges/new': [BADGE], '/api/profiles/2/badges/on%20a%20roll/art': { ...BADGE, art_status: 'ready', personal_art_url: '/static/badge-art/x.webp' } })
    const api = bindBadgesApi({ fetch, baseUrl: '' })
    expect(await api.newBadges(2)).toEqual([PARSED_BADGE])
    await api.markCelebrated(2, 'k')
    expect((await api.paint(2, 'on a roll')).personal_art_url).toBe('/static/badge-art/x.webp')
    expect(fetch.calls).toEqual(['GET /api/profiles/2/badges/new', 'POST /api/profiles/2/badges/k/celebrated', 'POST /api/profiles/2/badges/on%20a%20roll/art'])
  })

  it('rejects a failed or malformed response', async () => {
    await expect(bindBadgesApi({ fetch: serving({}, 500), baseUrl: '' }).badges(1)).rejects.toThrow('GET /api/profiles/1/badges failed with HTTP 500')
    await expect(bindBadgesApi({ fetch: serving({}, 409), baseUrl: '' }).markCelebrated(1, 'k')).rejects.toThrow('POST /api/profiles/1/badges/k/celebrated failed with HTTP 409')
    await expect(bindBadgesApi({ fetch: serving({ '/api/profiles/1/stats': { total_stars: 'x' } }), baseUrl: '' }).stats(1)).rejects.toThrow('unexpected body')
    await expect(bindBadgesApi({ fetch: serving({ '/api/profiles/1/badges': [{ ...BADGE, tier: 'platinum' }] }), baseUrl: '' }).badges(1)).rejects.toThrow('unexpected body')
  })
})
