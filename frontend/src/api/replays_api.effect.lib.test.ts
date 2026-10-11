import { describe, expect, it } from 'vitest'
import type { HttpFetch } from './http.pure.lib.ts'
import { bindReplaysApi } from './replays_api.effect.lib.ts'

const SUMMARY = { id: 'r1', profile_id: 3, created_at: '2026-10-11T12:00:00Z', outcome: 'survived', duration_ms: 60000, flags: 2, size_bytes: 900 }

describe('bindReplaysApi', () => {
  it('posts the recording and parses the summary', async () => {
    const sent: { url: string; body: unknown }[] = []
    const fetch: HttpFetch = (url, init) => {
      sent.push({ url, body: init.body === undefined ? undefined : JSON.parse(init.body) })
      return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve(SUMMARY) })
    }
    const api = bindReplaysApi({ fetch, baseUrl: '' })
    await expect(api.save(3, { outcome: 'survived', duration_ms: 60000, flags: 2, recording: { marks: [] } })).resolves.toEqual(SUMMARY)
    expect(sent).toEqual([{ url: '/api/profiles/3/horde/replays', body: { outcome: 'survived', duration_ms: 60000, flags: 2, recording: { marks: [] } } }])
  })

  it("rejects with the server's reason", async () => {
    const fetch: HttpFetch = () => Promise.resolve({ ok: false, status: 413, json: () => Promise.resolve({ detail: 'too big' }) })
    await expect(bindReplaysApi({ fetch, baseUrl: '' }).save(3, { outcome: 'left', duration_ms: 1, flags: 0, recording: {} })).rejects.toThrow('too big')
  })
})
