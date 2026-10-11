import { describe, expect, it } from 'vitest'
import type { HttpFetch } from './http.pure.lib.ts'
import { bindPracticeApi } from './practice_api.effect.lib.ts'

function recording(body: unknown, status = 200) {
  const calls: { url: string; method: string; body: string | undefined }[] = []
  const fetch: HttpFetch = (url, init) => {
    calls.push({ url, method: init.method, body: init.body })
    return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) })
  }
  return { fetch, calls }
}

const ATTEMPT = { id: 9, event_id: 'e1', correct: true, score: null, hints_used: 0, hint_offered: false, time_ms: 1200 }

describe('bindPracticeApi', () => {
  it('asks for the next item for this profile, game, and session', async () => {
    const { fetch, calls } = recording({ item_id: 'i1', game_id: 'syllable_builder', level: 2, payload: { target_word: 'rabbit' } })
    const item = await bindPracticeApi({ fetch, baseUrl: '' }).nextItem({ profileId: 3, gameId: 'syllable_builder', sessionId: 's 1' })
    expect(calls[0]?.url).toBe('/api/items/next?profile_id=3&game_id=syllable_builder&session_id=s+1')
    expect(item).toMatchObject({ item_id: 'i1', variant_id: null, payload: { target_word: 'rabbit' } })
  })

  it('posts an attempt and parses the record, and posts ratings and verifications', async () => {
    const { fetch, calls } = recording(ATTEMPT)
    const api = bindPracticeApi({ fetch, baseUrl: '' })
    const attempt = { item_id: 'i1', profile_id: 3, game_id: 'g', session_id: 's', telemetry: { correct: true, hints_used: 0, time_ms: 1200 } }
    expect(await api.recordAttempt(attempt)).toEqual(ATTEMPT)
    await api.rate({ profile_id: 3, game_id: 'g', scale: 'stars_1_5', value: 4 })
    await api.verify({ attempt_id: 9, correct: true, verified_by: 'parent' })
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['POST /api/attempts', 'POST /api/ratings', 'POST /api/verifications'])
    expect(JSON.parse(calls[2]?.body ?? '')).toEqual({ attempt_id: 9, correct: true, verified_by: 'parent' })
  })

  it('rejects failures and malformed bodies', async () => {
    await expect(bindPracticeApi({ ...recording(null, 500), baseUrl: '' }).nextItem({ profileId: 1, gameId: 'g', sessionId: 's' })).rejects.toThrow('HTTP 500')
    await expect(bindPracticeApi({ ...recording({ id: 'x' }), baseUrl: '' }).recordAttempt({ item_id: 'i', profile_id: 1, game_id: 'g', telemetry: { hints_used: 0, time_ms: 0 } })).rejects.toThrow('unexpected body')
  })
})
